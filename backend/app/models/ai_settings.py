"""
SQLAlchemy ORM model for per-user AI provider settings.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AISettings(Base):
    __tablename__ = "ai_settings"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    # cloud | byok
    mode: Mapped[str] = mapped_column(String(20), nullable=False, default="cloud")
    # openrouter | gemini | openai | claude | ollama
    provider: Mapped[str] = mapped_column(String(30), nullable=False, default="openrouter")

    encrypted_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str | None] = mapped_column(String(512), nullable=True)

    default_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    assistant_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    smart_entry_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    ocr_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    sms_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    gmail_model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    investment_advisor_model: Mapped[str | None] = mapped_column(String(128), nullable=True)

    cloud_fallback_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    user: Mapped["User"] = relationship(back_populates="ai_settings")

    def __repr__(self) -> str:
        return f"<AISettings user_id={self.user_id} mode={self.mode} provider={self.provider}>"
