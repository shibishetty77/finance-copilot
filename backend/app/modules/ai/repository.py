"""
AI Settings repository — all database queries for ai_settings table.
Follows the repository pattern: no business logic here.
"""

import uuid
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai_settings import AISettings


class AISettingsRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_user_id(self, user_id: uuid.UUID) -> AISettings | None:
        result = await self.db.execute(select(AISettings).where(AISettings.user_id == str(user_id)))
        return result.scalar_one_or_none()

    async def create_default(self, user_id: uuid.UUID) -> AISettings:
        from app.config import settings as app_settings
        ai_settings = AISettings(
            user_id=str(user_id),
            mode="byok",
            provider="ollama",
            base_url=app_settings.OLLAMA_URL,
            default_model=app_settings.OLLAMA_MODEL,
            cloud_fallback_enabled=False,
        )
        self.db.add(ai_settings)
        await self.db.flush()
        await self.db.refresh(ai_settings)
        return ai_settings

    async def get_or_create_default(self, user_id: uuid.UUID) -> AISettings:
        settings = await self.get_by_user_id(user_id)
        if not settings:
            settings = await self.create_default(user_id)
        return settings

    async def update(
        self,
        user_id: uuid.UUID,
        mode: str | None = None,
        provider: str | None = None,
        encrypted_api_key: str | None = None,
        base_url: str | None = None,
        default_model: str | None = None,
        assistant_model: str | None = None,
        smart_entry_model: str | None = None,
        ocr_model: str | None = None,
        sms_model: str | None = None,
        gmail_model: str | None = None,
        investment_advisor_model: str | None = None,
        cloud_fallback_enabled: bool | None = None,
    ) -> AISettings:
        values: dict[str, Any] = {}
        if mode is not None:
            values["mode"] = mode
        if provider is not None:
            values["provider"] = provider
        if encrypted_api_key is not None:
            values["encrypted_api_key"] = encrypted_api_key
        if base_url is not None:
            values["base_url"] = base_url
        if default_model is not None:
            values["default_model"] = default_model
        if assistant_model is not None:
            values["assistant_model"] = assistant_model
        if smart_entry_model is not None:
            values["smart_entry_model"] = smart_entry_model
        if ocr_model is not None:
            values["ocr_model"] = ocr_model
        if sms_model is not None:
            values["sms_model"] = sms_model
        if gmail_model is not None:
            values["gmail_model"] = gmail_model
        if investment_advisor_model is not None:
            values["investment_advisor_model"] = investment_advisor_model
        if cloud_fallback_enabled is not None:
            values["cloud_fallback_enabled"] = cloud_fallback_enabled

        # Get or create the settings first
        settings = await self.get_or_create_default(user_id)

        if values:
            # Update each field directly on the model instance
            for key, value in values.items():
                setattr(settings, key, value)

        return settings
