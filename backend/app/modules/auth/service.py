"""
Auth service — business logic for registration, login, and token management.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from app.models.user import User
from app.modules.auth.repository import UserRepository
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
)


class AuthService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = UserRepository(db)

    async def register(self, payload: RegisterRequest) -> User:
        """Create a new user account."""
        if await self.repo.email_exists(payload.email):
            raise ConflictError("An account with this email already exists")

        hashed = hash_password(payload.password)
        user = await self.repo.create(
            email=payload.email,
            full_name=payload.full_name,
            hashed_password=hashed,
            phone=payload.phone,
        )
        return user

    async def login(self, payload: LoginRequest) -> tuple[str, str]:
        """
        Validate credentials and return (access_token, refresh_token).
        Raises UnauthorizedError on bad credentials.
        """
        print(f"[AUTH SERVICE] Login called with email: {payload.email}")
        try:
            user = await self.repo.get_by_email(payload.email)
            print(f"[AUTH SERVICE] User lookup result: {user}")
            if not user:
                print(f"[AUTH SERVICE] User not found")
                raise UnauthorizedError("Invalid email or password")
            
            print(f"[AUTH SERVICE] Verifying password")
            password_valid = verify_password(payload.password, user.hashed_password)
            print(f"[AUTH SERVICE] Password valid: {password_valid}")
            
            if not password_valid:
                print(f"[AUTH SERVICE] Invalid password")
                raise UnauthorizedError("Invalid email or password")
                
            if not user.is_active:
                print(f"[AUTH SERVICE] User not active")
                raise UnauthorizedError("Account is deactivated. Contact support.")

            print(f"[AUTH SERVICE] Creating tokens for user_id: {user.id}")
            access_token = create_access_token(str(user.id))
            refresh_token = create_refresh_token(str(user.id))
            print(f"[AUTH SERVICE] Tokens created successfully")
            return access_token, refresh_token
        except UnauthorizedError:
            raise
        except Exception as e:
            print(f"[AUTH SERVICE] Exception during login: {type(e).__name__}: {e}")
            import traceback
            print(f"[AUTH SERVICE] Traceback:\n{traceback.format_exc()}")
            raise

    async def refresh(self, refresh_token: str) -> str:
        """
        Validate refresh token and issue a new access token.
        Refresh token rotation is enforced on the cookie side.
        """
        try:
            user_id = verify_refresh_token(refresh_token)
        except Exception:
            raise UnauthorizedError("Invalid or expired refresh token")

        user = await self.repo.get_by_id(uuid.UUID(user_id))
        if not user or not user.is_active:
            raise UnauthorizedError("User not found or deactivated")

        return create_access_token(str(user.id))

    async def get_current_user(self, user_id: uuid.UUID) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise UnauthorizedError("User not found")
        return user

    async def update_profile(
        self, user_id: uuid.UUID, payload: UpdateProfileRequest
    ) -> User:
        user = await self.repo.update_profile(
            user_id=user_id,
            full_name=payload.full_name,
            phone=payload.phone,
        )
        if not user:
            raise UnauthorizedError("User not found")
        return user

    async def change_password(
        self, user_id: uuid.UUID, payload: ChangePasswordRequest
    ) -> None:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise UnauthorizedError("User not found")
        if not verify_password(payload.current_password, user.hashed_password):
            raise UnauthorizedError("Current password is incorrect")

        new_hashed = hash_password(payload.new_password)
        await self.repo.update_password(user_id, new_hashed)
