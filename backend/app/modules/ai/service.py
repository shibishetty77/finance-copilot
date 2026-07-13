"""
AI module — AIService: the single reusable AI entry point.

Architecture rule: Every future AI feature (Smart Entry, Assistant, OCR, SMS,
Statement, Gmail) must call AIService methods only. No module should
instantiate a provider directly.

AIService responsibilities:
  - Execute prompts via the injected AIProvider
  - Retry transient failures with exponential backoff
  - Enforce a per-call timeout
  - Validate JSON responses against optional schemas
  - Log and track usage for every call
  - Translate provider exceptions into clean AIModule exceptions

Public interface:
  - generate_text(prompt, context?)  → AIResponse
  - generate_structured(prompt, context?, schema?)  → StructuredResponse
  - chat(messages, context?)  → ChatResponse
"""

import asyncio
import json
import logging
from typing import Any

from app.config import settings
from app.modules.ai.exceptions import (
    AIInvalidResponseError,
    AIProviderError,
    AIRateLimitError,
    AITimeoutError,
)
from app.modules.ai.providers import AIProvider
from app.modules.ai.schemas import AIResponse, ChatMessage, ChatResponse, StructuredResponse
from app.modules.ai.usage import AIUsageTracker, elapsed_ms, start_timer

logger = logging.getLogger(__name__)

# ── Retry configuration ───────────────────────────────────────────────────────
_MAX_RETRIES = 3
_BASE_BACKOFF_SECONDS = 1.0   # doubles on each retry: 1s → 2s → 4s
_CALL_TIMEOUT_SECONDS = 30.0  # per-call timeout (before retries)

# Errors that are worth retrying
_RETRYABLE_ERRORS = (AIProviderError, AITimeoutError)


class AIService:
    """
    Reusable AI service — the single facade over the provider layer.

    Instantiated with a concrete AIProvider via dependency injection.
    Business modules should never hold a reference to the provider directly.

    Args:
        provider: An AIProvider instance (injected from get_provider()).
        tracker:  An AIUsageTracker instance (optional, defaults to a new one).

    Example (FastAPI endpoint):
        @router.post("/generate")
        async def generate(
            payload: AIRequest,
            provider: AIProvider = Depends(get_provider),
        ):
            svc = AIService(provider)
            return await svc.generate_text(payload.prompt, payload.context)
    """

    def __init__(
        self,
        provider: AIProvider,
        tracker: AIUsageTracker | None = None,
    ) -> None:
        self._provider = provider
        self._tracker = tracker or AIUsageTracker()

    # ── Public API ────────────────────────────────────────────────────────────

    async def generate_text(
        self,
        prompt: str,
        context: str | None = None,
    ) -> AIResponse:
        """
        Generate plain text from a prompt.

        Args:
            prompt:  The user-facing prompt.
            context: Optional system context prepended to the prompt.

        Returns:
            AIResponse with the generated text and metadata.
        """
        start = start_timer()
        try:
            text, tokens = await self._with_retry(
                self._provider.generate,
                prompt,
                context,
            )
            latency = elapsed_ms(start)
            self._tracker.record(
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                prompt_length=len(prompt),
                completion_length=len(text),
                tokens_used=tokens,
                latency_ms=latency,
            )
            return AIResponse(
                response=text,
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                tokens_used=tokens,
                latency_ms=round(latency, 2),
            )
        except Exception as exc:
            latency = elapsed_ms(start)
            self._tracker.record(
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                prompt_length=len(prompt),
                completion_length=0,
                tokens_used=None,
                latency_ms=latency,
                success=False,
                error_type=type(exc).__name__,
            )
            raise

    async def generate_structured(
        self,
        prompt: str,
        context: str | None = None,
        schema: dict[str, Any] | None = None,
    ) -> StructuredResponse:
        """
        Generate a structured JSON object from a prompt.

        Args:
            prompt:  The prompt instructing the provider to return JSON.
            context: Optional system context.
            schema:  Optional JSON Schema dict to validate the output against.

        Returns:
            StructuredResponse with the parsed data dict.

        Raises:
            AIInvalidResponseError: If parsing or schema validation fails.
        """
        start = start_timer()
        try:
            data, tokens = await self._with_retry(
                self._provider.generate_json,
                prompt,
                context,
            )
            if schema is not None:
                self._validate_json_schema(data, schema)
            latency = elapsed_ms(start)
            response_str = json.dumps(data)
            self._tracker.record(
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                prompt_length=len(prompt),
                completion_length=len(response_str),
                tokens_used=tokens,
                latency_ms=latency,
            )
            return StructuredResponse(
                data=data,
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                tokens_used=tokens,
                latency_ms=round(latency, 2),
            )
        except Exception as exc:
            latency = elapsed_ms(start)
            self._tracker.record(
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                prompt_length=len(prompt),
                completion_length=0,
                tokens_used=None,
                latency_ms=latency,
                success=False,
                error_type=type(exc).__name__,
            )
            raise

    async def chat(
        self,
        messages: list[ChatMessage],
        context: str | None = None,
    ) -> ChatResponse:
        """
        Multi-turn conversational completion.

        Args:
            messages: Ordered list of ChatMessage objects.
            context:  Optional system context injected at conversation start.

        Returns:
            ChatResponse with the assistant's reply.
        """
        raw_messages = [{"role": m.role, "content": m.content} for m in messages]
        prompt_length = sum(len(m.content) for m in messages)
        start = start_timer()
        try:
            text, tokens = await self._with_retry(
                self._provider.chat,
                raw_messages,
                context,
            )
            latency = elapsed_ms(start)
            self._tracker.record(
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                prompt_length=prompt_length,
                completion_length=len(text),
                tokens_used=tokens,
                latency_ms=latency,
            )
            return ChatResponse(
                response=text,
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                tokens_used=tokens,
                latency_ms=round(latency, 2),
            )
        except Exception as exc:
            latency = elapsed_ms(start)
            self._tracker.record(
                provider=self._provider.provider_name,
                model=self._provider.model_name,
                prompt_length=prompt_length,
                completion_length=0,
                tokens_used=None,
                latency_ms=latency,
                success=False,
                error_type=type(exc).__name__,
            )
            raise

    # ── Internal helpers ──────────────────────────────────────────────────────

    @staticmethod
    async def _with_retry(fn: Any, *args: Any) -> Any:
        """
        Call fn(*args) with exponential-backoff retries and a per-call timeout.

        Retries on transient errors (AIProviderError, AITimeoutError).
        Does NOT retry on AIRateLimitError or AIInvalidResponseError.

        Args:
            fn:    An async callable (provider method).
            *args: Arguments forwarded to fn.

        Returns:
            Whatever fn returns.

        Raises:
            The last exception after all retries are exhausted.
        """
        last_exc: Exception | None = None
        for attempt in range(1, _MAX_RETRIES + 1):
            try:
                return await asyncio.wait_for(fn(*args), timeout=_CALL_TIMEOUT_SECONDS)
            except asyncio.TimeoutError as exc:
                last_exc = AITimeoutError()
                logger.warning("AI call timed out (attempt %d/%d)", attempt, _MAX_RETRIES)
            except AIRateLimitError:
                raise  # Never retry rate limits
            except _RETRYABLE_ERRORS as exc:  # type: ignore[misc]
                last_exc = exc
                logger.warning(
                    "AI call failed (attempt %d/%d): %s",
                    attempt, _MAX_RETRIES, exc,
                )
            except Exception:
                raise  # Non-retryable — re-raise immediately

            if attempt < _MAX_RETRIES:
                backoff = _BASE_BACKOFF_SECONDS * (2 ** (attempt - 1))
                logger.info("Retrying AI call in %.1fs...", backoff)
                await asyncio.sleep(backoff)

        raise last_exc  # type: ignore[misc]

    @staticmethod
    def _validate_json_schema(data: dict[str, Any], schema: dict[str, Any]) -> None:
        """
        Basic required-field JSON schema validation.

        Checks that all required fields listed in schema["required"] are present
        in the data dict. Full JSON Schema validation can be added later with
        the jsonschema library.

        Raises:
            AIInvalidResponseError: If any required field is missing.
        """
        required_fields: list[str] = schema.get("required", [])
        missing = [f for f in required_fields if f not in data]
        if missing:
            raise AIInvalidResponseError(
                f"AI response missing required fields: {missing}"
            )
