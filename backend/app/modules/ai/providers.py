"""
AI module — provider abstraction layer.

Architecture rule: Nothing outside this file should ever import
google.generativeai, openai, anthropic, or any provider SDK.

To add a new provider:
  1. Subclass AIProvider.
  2. Implement generate(), generate_json(), and chat().
  3. Add the provider name to the PROVIDER_REGISTRY dict at the bottom.
  4. Update AI_PROVIDER in your .env.

That is the only change required.
"""

import json
import logging
from abc import ABC, abstractmethod
from typing import Any

from app.config import settings
from app.modules.ai.exceptions import (
    AIConfigurationError,
    AIInvalidResponseError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)

logger = logging.getLogger(__name__)


# ── Abstract base ─────────────────────────────────────────────────────────────


class AIProvider(ABC):
    """
    Abstract base class for all AI providers.

    Every concrete provider must implement all three methods.
    The AIService depends only on this interface — never on a concrete class.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider identifier (e.g. 'gemini')."""
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """The specific model being used (e.g. 'gemini-2.5-flash')."""
        ...

    @abstractmethod
    async def generate(self, prompt: str, context: str | None = None) -> tuple[str, int | None]:
        """
        Generate plain text from a prompt.

        Args:
            prompt:  The user's prompt.
            context: Optional system-level instructions.

        Returns:
            (response_text, tokens_used)  — tokens_used may be None if
            the provider does not expose usage.
        """
        ...

    @abstractmethod
    async def generate_json(
        self,
        prompt: str,
        context: str | None = None,
    ) -> tuple[dict[str, Any], int | None]:
        """
        Generate a structured JSON object from a prompt.

        Args:
            prompt:  The user's prompt (should instruct JSON output).
            context: Optional system-level instructions.

        Returns:
            (parsed_dict, tokens_used)
        """
        ...

    @abstractmethod
    async def chat(
        self,
        messages: list[dict[str, str]],
        context: str | None = None,
    ) -> tuple[str, int | None]:
        """
        Multi-turn conversation.

        Args:
            messages: List of {"role": "user"|"assistant", "content": "..."}.
            context:  Optional system-level instructions.

        Returns:
            (response_text, tokens_used)
        """
        ...


# ── Gemini provider ───────────────────────────────────────────────────────────


class GeminiProvider(AIProvider):
    """
    Google Gemini provider using the google-generativeai SDK.

    Default model: gemini-2.5-flash (fastest, production-quality).
    Falls back gracefully when the SDK or API key is unavailable.
    """

    def __init__(self) -> None:
        self._validate_config()
        self._client = self._build_client()

    # ── Configuration ─────────────────────────────────────────────────────────

    def _validate_config(self) -> None:
        """Raise AIConfigurationError early if the API key is missing."""
        if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY.startswith("mock"):
            raise AIConfigurationError(
                "GEMINI_API_KEY is not set or is a placeholder. "
                "Set a real key in your .env to use the Gemini provider."
            )

    def _build_client(self) -> Any:
        """Import and configure the Gemini SDK client."""
        try:
            import google.generativeai as genai  # type: ignore[import]

            genai.configure(api_key=settings.GEMINI_API_KEY)
            return genai.GenerativeModel(
                model_name=settings.MODEL_NAME,
                generation_config={
                    "temperature": settings.TEMPERATURE,
                    "max_output_tokens": settings.MAX_TOKENS,
                },
            )
        except ImportError as exc:
            raise AIConfigurationError(
                "google-generativeai package is not installed. "
                "Run: pip install google-generativeai"
            ) from exc

    # ── Properties ────────────────────────────────────────────────────────────

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return settings.MODEL_NAME

    # ── Core methods ──────────────────────────────────────────────────────────

    async def generate(self, prompt: str, context: str | None = None) -> tuple[str, int | None]:
        """Generate plain text via Gemini."""
        full_prompt = self._build_prompt(prompt, context)
        try:
            response = await self._client.generate_content_async(full_prompt)
            text = response.text
            tokens = self._extract_tokens(response)
            return text, tokens
        except Exception as exc:
            self._handle_provider_error(exc)

    async def generate_json(
        self,
        prompt: str,
        context: str | None = None,
    ) -> tuple[dict[str, Any], int | None]:
        """Generate structured JSON via Gemini."""
        json_instruction = (
            "\n\nIMPORTANT: Your response must be valid JSON only. "
            "Do not include markdown fences, explanations, or any text outside the JSON object."
        )
        full_prompt = self._build_prompt(prompt + json_instruction, context)
        try:
            response = await self._client.generate_content_async(full_prompt)
            text = response.text.strip()
            # Strip markdown fences if present
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            parsed = json.loads(text)
            tokens = self._extract_tokens(response)
            return parsed, tokens
        except json.JSONDecodeError as exc:
            raise AIInvalidResponseError(
                f"Gemini returned non-JSON content: {exc}"
            ) from exc
        except Exception as exc:
            self._handle_provider_error(exc)

    async def chat(
        self,
        messages: list[dict[str, str]],
        context: str | None = None,
    ) -> tuple[str, int | None]:
        """Multi-turn conversation via Gemini chat session."""
        try:
            chat_session = self._client.start_chat(history=[])
            # Inject context as a system-like first message if provided
            if context:
                await chat_session.send_message_async(
                    f"[System Instructions]\n{context}"
                )
            response = None
            for msg in messages:
                if msg["role"] in ("user", "assistant"):
                    response = await chat_session.send_message_async(msg["content"])
            if response is None:
                raise AIInvalidResponseError("No messages were sent to the chat session.")
            text = response.text
            tokens = self._extract_tokens(response)
            return text, tokens
        except (AIProviderError, AIConfigurationError, AITimeoutError,
                AIRateLimitError, AIInvalidResponseError):
            raise
        except Exception as exc:
            self._handle_provider_error(exc)

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _build_prompt(prompt: str, context: str | None) -> str:
        """Prepend system context to the prompt when provided."""
        if context:
            return f"[Context]\n{context}\n\n[Request]\n{prompt}"
        return prompt

    @staticmethod
    def _extract_tokens(response: Any) -> int | None:
        """Safely extract token usage from a Gemini response object."""
        try:
            usage = response.usage_metadata
            if usage:
                return (usage.prompt_token_count or 0) + (usage.candidates_token_count or 0)
        except AttributeError:
            pass
        return None

    @staticmethod
    def _handle_provider_error(exc: Exception) -> None:
        """Map provider-specific errors to our domain exceptions."""
        error_str = str(exc).lower()
        if "timeout" in error_str or "deadline" in error_str:
            raise AITimeoutError() from exc
        if "429" in error_str or "quota" in error_str or "rate" in error_str:
            raise AIRateLimitError() from exc
        if "api key" in error_str or "credentials" in error_str or "auth" in error_str:
            raise AIConfigurationError(
                "Authentication failed with Gemini. Check your GEMINI_API_KEY."
            ) from exc
        logger.exception("Unhandled Gemini error: %s", exc)
        raise AIProviderError(f"Gemini provider error: {type(exc).__name__}") from exc


# ── Provider registry & factory ───────────────────────────────────────────────

# To add a new provider: add its class here. No other file needs to change.
PROVIDER_REGISTRY: dict[str, type[AIProvider]] = {
    "gemini": GeminiProvider,
    # "openai": OpenAIProvider,   # future
    # "claude": ClaudeProvider,   # future
}


def get_provider() -> AIProvider:
    """
    Factory function — returns the configured AIProvider instance.

    Reads AI_PROVIDER from settings. Raises AIConfigurationError if the
    provider name is unknown or the provider cannot be initialised.

    Usage (dependency injection in FastAPI):
        provider: AIProvider = Depends(get_provider)
    """
    provider_name = settings.AI_PROVIDER.lower()
    provider_class = PROVIDER_REGISTRY.get(provider_name)
    if provider_class is None:
        raise AIConfigurationError(
            f"Unknown AI provider: '{provider_name}'. "
            f"Available providers: {list(PROVIDER_REGISTRY.keys())}"
        )
    return provider_class()
