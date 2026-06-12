"""
Pydantic schemas for authentication endpoints.
Covers registration, login, token responses, profile CRUD.
"""

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ── Helpers ───────────────────────────────────────────────────────────────────
PASSWORD_PATTERN = re.compile(
    r"^(?=.*[A-Z])(?=.*[0-9]).{8,}$"
)


def validate_password(v: str) -> str:
    if not PASSWORD_PATTERN.match(v):
        raise ValueError(
            "Password must be at least 8 characters, contain 1 uppercase letter and 1 digit"
        )
    return v


# ── Request schemas ───────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255, examples=["Riya Sharma"])
    email: EmailStr = Field(..., examples=["riya@example.com"])
    password: str = Field(..., min_length=8, examples=["Passw0rd!"])
    phone: str | None = Field(None, pattern=r"^[6-9]\d{9}$", examples=["9876543210"])

    @field_validator("password")
    @classmethod
    def strong_password(cls, v: str) -> str:
        return validate_password(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def strong_new_password(cls, v: str) -> str:
        return validate_password(v)


class UpdateProfileRequest(BaseModel):
    full_name: str | None = Field(None, min_length=2, max_length=255)
    phone: str | None = Field(None, pattern=r"^[6-9]\d{9}$")


# ── Response schemas ──────────────────────────────────────────────────────────
class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    phone: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RegisterResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    message: str = "Account created successfully"


class MessageResponse(BaseModel):
    message: str
