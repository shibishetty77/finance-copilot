"""
Application configuration via pydantic-settings.
All settings are loaded from environment variables or .env file.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ───────────────────────────────────────────────────────────
    APP_NAME: str = "Finance Copilot"
    APP_ENV: Literal["development", "staging", "production"] = "development"
    DEBUG: bool = False

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str  # postgresql+asyncpg://...

    # ── Security ──────────────────────────────────────────────────────────────
    SECRET_KEY: str
    ENCRYPTION_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:8000"

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    # ── AI ────────────────────────────────────────────────────────────────────
    # Provider selection — only this value needs changing to switch providers.
    AI_PROVIDER: str = "ollama"  # ollama | gemini | openai | claude

    # ── Ollama (local) ────────────────────────────────────────────────────────
    OLLAMA_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2:3b"
    OLLAMA_TIMEOUT: int = 60

    # ── OCR ───────────────────────────────────────────────────────────────────
    # Optional explicit path to the tesseract executable.
    # If not provided, pytesseract will look for 'tesseract' on the system PATH.
    TESSERACT_CMD: str | None = None

    # Model configuration
    MODEL_NAME: str = "llama3.2:3b"
    TEMPERATURE: float = 0.2
    MAX_TOKENS: int = 2048

    # Short-name aliases for switching between models without full ID strings.
    # Usage: settings.AVAILABLE_MODELS["flash"] → "gemini-2.5-flash"
    AVAILABLE_MODELS: dict[str, str] = {
        "flash": "gemini-2.5-flash",
        "pro": "gemini-2.5-pro",
    }

    # API keys — never expose to frontend
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""  # reserved for future OpenAI provider

    # ── Rate Limiting ─────────────────────────────────────────────────────────
    RATE_LIMIT_PER_MINUTE: int = 200
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10

    # ── Google OAuth ──────────────────────────────────────────────────────────
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = "http://localhost:5173/gmail-callback"

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


@lru_cache
def get_settings() -> Settings:
    """Cached settings instance — call this everywhere."""
    return Settings()  # type: ignore[call-arg]


settings = get_settings()
