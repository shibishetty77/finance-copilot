"""
JWT token creation/verification and password hashing.
Centralizes all cryptographic operations for the application.
"""

from datetime import UTC, datetime, timedelta
from typing import Any

from jose import JWTError, jwt
import bcrypt

from app.config import settings


# ── Password hashing ──────────────────────────────────────────────────────────
# bcrypt with cost factor 12 — secure and production-appropriate

def verify_password(plain: str, hashed: str) -> bool:
    """Compare a plain password against its bcrypt hash."""
    # bcrypt has a 72-byte password limit, truncate if necessary
    plain_bytes = plain.encode('utf-8')
    if len(plain_bytes) > 72:
        plain_bytes = plain_bytes[:72]
    return bcrypt.checkpw(plain_bytes, hashed.encode('utf-8'))


def hash_password(plain: str) -> str:
    """Hash a plain password using bcrypt."""
    # bcrypt has a 72-byte password limit, truncate if necessary
    plain_bytes = plain.encode('utf-8')
    if len(plain_bytes) > 72:
        plain_bytes = plain_bytes[:72]
    return bcrypt.hashpw(plain_bytes, bcrypt.gensalt(rounds=12)).decode('utf-8')


# ── JWT tokens ────────────────────────────────────────────────────────────────
def _create_token(data: dict[str, Any], expires_delta: timedelta) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(UTC) + expires_delta
    payload["iat"] = datetime.now(UTC)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_access_token(subject: str) -> str:
    """Create a short-lived access token (default 15 min)."""
    return _create_token(
        {"sub": subject, "type": "access"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(subject: str) -> str:
    """Create a long-lived refresh token (default 7 days)."""
    return _create_token(
        {"sub": subject, "type": "refresh"},
        timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT token.
    Raises JWTError on invalid/expired tokens.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def verify_access_token(token: str) -> str:
    """
    Validate an access token and return the user ID (subject).
    Raises JWTError if invalid or wrong type.
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise JWTError("Invalid token type")
    sub: str | None = payload.get("sub")
    if sub is None:
        raise JWTError("Missing subject claim")
    return sub


def verify_refresh_token(token: str) -> str:
    """
    Validate a refresh token and return the user ID (subject).
    Raises JWTError if invalid or wrong type.
    """
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise JWTError("Invalid token type")
    sub: str | None = payload.get("sub")
    if sub is None:
        raise JWTError("Missing subject claim")
    return sub
