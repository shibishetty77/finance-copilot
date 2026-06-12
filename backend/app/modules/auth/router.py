"""
Auth router — HTTP endpoints for authentication and user profile.
All endpoints follow the API specification exactly.
"""

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.config import settings
from app.core.exceptions import UnauthorizedError
from app.core.rate_limiter import limiter
from app.core.security import verify_access_token
from app.database import AsyncSession, get_db
from app.modules.auth.service import AuthService
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    RegisterResponse,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
bearer_scheme = HTTPBearer(auto_error=False)

# ── Helpers ───────────────────────────────────────────────────────────────────
REFRESH_COOKIE = "refresh_token"
REFRESH_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite="lax",
        max_age=REFRESH_MAX_AGE,
        path="/api/v1/auth/refresh",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path="/api/v1/auth/refresh")


# ── Registration ──────────────────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user account",
)
@limiter.limit(f"{settings.AUTH_RATE_LIMIT_PER_MINUTE}/minute")
async def register(
    request: Request,
    payload: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> RegisterResponse:
    svc = AuthService(db)
    user = await svc.register(payload)
    return RegisterResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
    )


# ── Login ─────────────────────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive JWT tokens",
)
@limiter.limit(f"{settings.AUTH_RATE_LIMIT_PER_MINUTE}/minute")
async def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    print(f"[AUTH LOGIN] Endpoint called")
    print(f"[AUTH LOGIN] Email: {payload.email}")
    try:
        svc = AuthService(db)
        access_token, refresh_token = await svc.login(payload)
        print(f"[AUTH LOGIN] Login successful, tokens generated")
        _set_refresh_cookie(response, refresh_token)
        print(f"[AUTH LOGIN] Refresh cookie set")
        token_response = TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        print(f"[AUTH LOGIN] Returning token response")
        return token_response
    except Exception as e:
        print(f"[AUTH LOGIN] Exception: {type(e).__name__}: {e}")
        import traceback
        print(f"[AUTH LOGIN] Traceback:\n{traceback.format_exc()}")
        raise


# ── Refresh ───────────────────────────────────────────────────────────────────
@router.post(
    "/refresh",
    response_model=TokenResponse,
    summary="Refresh access token using httpOnly refresh cookie",
)
async def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None, alias=REFRESH_COOKIE),
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    if not refresh_token:
        raise UnauthorizedError("Refresh token missing")
    svc = AuthService(db)
    new_access = await svc.refresh(refresh_token)
    return TokenResponse(
        access_token=new_access,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ── Logout ────────────────────────────────────────────────────────────────────
@router.post(
    "/logout",
    response_model=MessageResponse,
    summary="Logout — clear refresh token cookie",
)
async def logout(response: Response) -> MessageResponse:
    _clear_refresh_cookie(response)
    return MessageResponse(message="Logged out successfully")


# ── Current user (me) ─────────────────────────────────────────────────────────
async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """Extract and validate the Bearer token, return user ID string."""
    if not credentials:
        raise UnauthorizedError("Authorization header missing")
    try:
        user_id = verify_access_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Invalid or expired access token")
    return user_id


@router.get(
    "/me",
    response_model=UserResponse,
    summary="Get current user profile",
)
async def get_me(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    import uuid
    svc = AuthService(db)
    user = await svc.get_current_user(uuid.UUID(user_id))
    return UserResponse.model_validate(user)


@router.patch(
    "/me",
    response_model=UserResponse,
    summary="Update current user profile",
)
async def update_me(
    payload: UpdateProfileRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    import uuid
    svc = AuthService(db)
    user = await svc.update_profile(uuid.UUID(user_id), payload)
    return UserResponse.model_validate(user)


@router.post(
    "/change-password",
    response_model=MessageResponse,
    summary="Change user password",
)
async def change_password(
    payload: ChangePasswordRequest,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    import uuid
    svc = AuthService(db)
    await svc.change_password(uuid.UUID(user_id), payload)
    return MessageResponse(message="Password updated successfully")
