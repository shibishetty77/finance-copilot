"""
Shared FastAPI dependency functions.
Used via Depends() in route handlers across all modules.
"""

import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError
from app.core.security import verify_access_token
from app.database import get_db
from app.models.user import User
from app.modules.auth.repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Validate Bearer access token and return the authenticated User model.
    Raises HTTP 401 on any auth failure.
    Inject this into any protected route: `user: User = Depends(get_current_user)`
    """
    if not credentials:
        raise UnauthorizedError("Authorization header missing")

    try:
        user_id_str = verify_access_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Invalid or expired access token")

    repo = UserRepository(db)
    user = await repo.get_by_id(uuid.UUID(user_id_str))

    if not user:
        raise UnauthorizedError("User not found")
    if not user.is_active:
        raise UnauthorizedError("Account is deactivated")

    return user
