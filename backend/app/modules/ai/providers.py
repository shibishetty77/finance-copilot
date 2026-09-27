"""
AI module — provider abstraction layer.

Architecture rule: Nothing outside this file should ever import
google.generativeai, openai, anthropic, or any provider SDK.

To add a new provider:
  1. Subclass AIProvider.
  2. Implement generate(), generate_json(), chat(), list_models(), health_check()
  3. Add the provider name to the PROVIDER_REGISTRY dict at the bottom.

All providers can now be instantiated with custom API key, base URL, model name.
"""

import json
import logging
import traceback
from abc import ABC, abstractmethod
from typing import Any

from app.config import settings
from app.core.encryption import decrypt_value
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

    Every concrete provider must implement all methods.
    The AIService depends only on this interface — never on a concrete class.
    """

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Human-readable provider identifier (e.g. "gemini", "openrouter")."""
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """The specific model being used (e.g. "gemini-2.5-flash")."""
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

    @abstractmethod
    async def list_models(self) -> list[str]:
        """List available models for this provider (if supported)."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Perform a simple health check (small generation) to verify connection."""
        ...


# ── Gemini Provider (Cloud & BYO) ────────────────────────────────────────────

class GeminiProvider(AIProvider):
    """
    Google Gemini provider using the google-generativeai SDK.
    Can be used for both CortexFi Cloud (with system key) and BYO mode.
    """

    def __init__(
        self,
        api_key: str | None = None,
        model_name: str | None = None,
    ) -> None:
        self._api_key = api_key or settings.GEMINI_API_KEY
        self._model_name = model_name or settings.MODEL_NAME
        self._validate_config()
        self._client = self._build_client()

    def _validate_config(self) -> None:
        """Raise AIConfigurationError early if the API key is missing."""
        if not self._api_key or self._api_key.startswith("mock"):
            raise AIConfigurationError(
                "Gemini API key is not set or is a placeholder. "
                "Set GEMINI_API_KEY in environment or provide a valid key."
            )

    def _build_client(self) -> Any:
        """Import and configure the Gemini SDK client."""
        try:
            import google.generativeai as genai

            genai.configure(api_key=self._api_key)  # type: ignore[attr-defined]
            return genai.GenerativeModel(  # type: ignore[attr-defined]
                model_name=self._model_name,
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

    @property
    def provider_name(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self._model_name

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
            raise  # Unreachable, but mypy needs this

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
            import google.generativeai as genai
            config = genai.types.GenerationConfig(
                temperature=settings.TEMPERATURE,
                max_output_tokens=settings.MAX_TOKENS,
                response_mime_type="application/json",
            )
            response = await self._client.generate_content_async(
                full_prompt,
                generation_config=config,
            )
            text = response.text.strip()
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
            raise  # Unreachable, but mypy needs this

    async def chat(
        self,
        messages: list[dict[str, str]],
        context: str | None = None,
    ) -> tuple[str, int | None]:
        """Multi-turn conversation via Gemini chat session."""
        try:
            chat_session = self._client.start_chat(history=[])
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
            raise  # Unreachable, but mypy needs this

    async def list_models(self) -> list[str]:
        """List available Gemini models."""
        try:
            import google.generativeai as genai
            models = genai.list_models()  # type: ignore[attr-defined]
            return [model.name for model in models if "gemini" in model.name]
        except Exception as exc:
            logger.error("Failed to list Gemini models: %s", exc)
            return [settings.MODEL_NAME]

    async def health_check(self) -> bool:
        """Simple health check: generate a tiny response."""
        try:
            response = await self.generate("Say 'OK'")
            return "OK" in response[0]
        except Exception:
            return False

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
        traceback.print_exc()
        logger.error("[DEBUG] Original exception repr: %s", repr(exc))
        error_str = str(exc).lower()
        if "timeout" in error_str or "deadline" in error_str:
            raise AITimeoutError() from exc
        if "429" in error_str or "quota" in error_str or "rate" in error_str:
            raise AIRateLimitError() from exc
        if "api key" in error_str or "credentials" in error_str or "auth" in error_str:
            raise AIConfigurationError(
                "Authentication failed with Gemini. Check your API key."
            ) from exc
        logger.exception("Unhandled Gemini error: %s", exc)
        raise AIProviderError(f"Gemini provider error: {type(exc).__name__}") from exc


# ── OpenAI Provider (BYO) ─────────────────────────────────────────────────────

class OpenAIProvider(AIProvider):
    """
    OpenAI provider using the openai SDK.
    Can be used with custom API key, base URL, model.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "gpt-4o-mini",
        base_url: str | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model_name = model_name
        self._validate_config()
        self._client = self._build_client()

    def _validate_config(self) -> None:
        if not self._api_key:
            raise AIConfigurationError("OpenAI API key is required.")
        if not self._model_name:
            raise AIConfigurationError("OpenAI model name is required.")

    def _build_client(self) -> Any:
        try:
            from openai import AsyncOpenAI
            return AsyncOpenAI(
                api_key=self._api_key,
                base_url=self._base_url,
            )
        except ImportError as exc:
            raise AIConfigurationError(
                "openai package is not installed. Run: pip install openai"
            ) from exc

    @property
    def provider_name(self) -> str:
        return "openai"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def generate(self, prompt: str, context: str | None = None) -> tuple[str, int | None]:
        try:
            messages = []
            if context:
                messages.append({"role": "system", "content": context})
            messages.append({"role": "user", "content": prompt})
            response = await self._client.chat.completions.create(
                model=self._model_name,
                messages=messages,
                temperature=settings.TEMPERATURE,
                max_tokens=settings.MAX_TOKENS,
            )
            text = response.choices[0].message.content or ""
            tokens = response.usage.total_tokens if response.usage else None
            return text, tokens
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def generate_json(
        self,
        prompt: str,
        context: str | None = None,
    ) -> tuple[dict[str, Any], int | None]:
        try:
            messages = []
            if context:
                messages.append({"role": "system", "content": context})
            messages.append({"role": "user", "content": prompt})
            response = await self._client.chat.completions.create(
                model=self._model_name,
                messages=messages,
                temperature=settings.TEMPERATURE,
                max_tokens=settings.MAX_TOKENS,
                response_format={"type": "json_object"},
            )
            text = response.choices[0].message.content or ""
            parsed = json.loads(text)
            tokens = response.usage.total_tokens if response.usage else None
            return parsed, tokens
        except json.JSONDecodeError as exc:
            raise AIInvalidResponseError(
                f"OpenAI returned non-JSON content: {exc}"
            ) from exc
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def chat(
        self,
        messages: list[dict[str, str]],
        context: str | None = None,
    ) -> tuple[str, int | None]:
        try:
            final_messages = []
            if context:
                final_messages.append({"role": "system", "content": context})
            final_messages.extend(messages)
            response = await self._client.chat.completions.create(
                model=self._model_name,
                messages=final_messages,
                temperature=settings.TEMPERATURE,
                max_tokens=settings.MAX_TOKENS,
            )
            text = response.choices[0].message.content or ""
            tokens = response.usage.total_tokens if response.usage else None
            return text, tokens
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def list_models(self) -> list[str]:
        try:
            models = await self._client.models.list()
            return [model.id for model in models.data if "gpt" in model.id or "o1" in model.id]
        except Exception as exc:
            logger.error("Failed to list OpenAI models: %s", exc)
            return ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"]

    async def health_check(self) -> bool:
        try:
            response = await self.generate("Say 'OK'")
            return "OK" in response[0]
        except Exception:
            return False

    @staticmethod
    def _handle_provider_error(exc: Exception) -> None:
        from openai import APIError, APIConnectionError, APIStatusError, APITimeoutError, AuthenticationError, RateLimitError
        traceback.print_exc()
        logger.error("[DEBUG] Original exception repr: %s", repr(exc))
        if isinstance(exc, APITimeoutError):
            raise AITimeoutError() from exc
        if isinstance(exc, RateLimitError):
            raise AIRateLimitError() from exc
        if isinstance(exc, AuthenticationError):
            raise AIConfigurationError("Authentication failed with OpenAI. Check your API key.") from exc
        if isinstance(exc, (APIConnectionError, APIStatusError, APIError)):
            raise AIProviderError(f"OpenAI provider error: {exc}") from exc
        logger.exception("Unhandled OpenAI error: %s", exc)
        raise AIProviderError(f"OpenAI provider error: {type(exc).__name__}") from exc


# ── Claude Provider (Anthropic, BYO) ──────────────────────────────────────────

class ClaudeProvider(AIProvider):
    """
    Anthropic Claude provider using the anthropic SDK.
    Can be used with custom API key, base URL, model.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "claude-3-5-sonnet-20241022",
        base_url: str | None = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._model_name = model_name
        self._validate_config()
        self._client = self._build_client()

    def _validate_config(self) -> None:
        if not self._api_key:
            raise AIConfigurationError("Claude API key is required.")
        if not self._model_name:
            raise AIConfigurationError("Claude model name is required.")

    def _build_client(self) -> Any:
        try:
            from anthropic import AsyncAnthropic
            return AsyncAnthropic(
                api_key=self._api_key,
                base_url=self._base_url,
            )
        except ImportError as exc:
            raise AIConfigurationError(
                "anthropic package is not installed. Run: pip install anthropic"
            ) from exc

    @property
    def provider_name(self) -> str:
        return "claude"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def generate(self, prompt: str, context: str | None = None) -> tuple[str, int | None]:
        try:
            system_prompt = context or ""
            response = await self._client.messages.create(
                model=self._model_name,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}],
                temperature=settings.TEMPERATURE,
                max_tokens=settings.MAX_TOKENS,
            )
            text = response.content[0].text if response.content else ""
            tokens = response.usage.input_tokens + response.usage.output_tokens if response.usage else None
            return text, tokens
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def generate_json(
        self,
        prompt: str,
        context: str | None = None,
    ) -> tuple[dict[str, Any], int | None]:
        try:
            system_prompt = (context or "") + "\n\nRespond only with valid JSON, no markdown."
            response = await self._client.messages.create(
                model=self._model_name,
                system=system_prompt,
                messages=[{"role": "user", "content": prompt}],
                temperature=settings.TEMPERATURE,
                max_tokens=settings.MAX_TOKENS,
            )
            text = response.content[0].text if response.content else ""
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
                text = text.strip()
            parsed = json.loads(text)
            tokens = response.usage.input_tokens + response.usage.output_tokens if response.usage else None
            return parsed, tokens
        except json.JSONDecodeError as exc:
            raise AIInvalidResponseError(
                f"Claude returned non-JSON content: {exc}"
            ) from exc
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def chat(
        self,
        messages: list[dict[str, str]],
        context: str | None = None,
    ) -> tuple[str, int | None]:
        try:
            system_prompt = context or ""
            response = await self._client.messages.create(
                model=self._model_name,
                system=system_prompt,
                messages=messages,
                temperature=settings.TEMPERATURE,
                max_tokens=settings.MAX_TOKENS,
            )
            text = response.content[0].text if response.content else ""
            tokens = response.usage.input_tokens + response.usage.output_tokens if response.usage else None
            return text, tokens
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def list_models(self) -> list[str]:
        try:
            models = await self._client.models.list()
            return [model.id for model in models.data]
        except Exception as exc:
            logger.error("Failed to list Claude models: %s", exc)
            return ["claude-3-5-sonnet-20241022", "claude-3-opus-20240229", "claude-3-haiku-20240307"]

    async def health_check(self) -> bool:
        try:
            response = await self.generate("Say 'OK'")
            return "OK" in response[0]
        except Exception:
            return False

    @staticmethod
    def _handle_provider_error(exc: Exception) -> None:
        from anthropic import APIError, APIConnectionError, APIStatusError, APITimeoutError, AuthenticationError, RateLimitError
        traceback.print_exc()
        logger.error("[DEBUG] Original exception repr: %s", repr(exc))
        if isinstance(exc, APITimeoutError):
            raise AITimeoutError() from exc
        if isinstance(exc, RateLimitError):
            raise AIRateLimitError() from exc
        if isinstance(exc, AuthenticationError):
            raise AIConfigurationError("Authentication failed with Claude. Check your API key.") from exc
        if isinstance(exc, (APIConnectionError, APIStatusError, APIError)):
            raise AIProviderError(f"Claude provider error: {exc}") from exc
        logger.exception("Unhandled Claude error: %s", exc)
        raise AIProviderError(f"Claude provider error: {type(exc).__name__}") from exc


# ── OpenRouter Provider (BYO) ────────────────────────────────────────────────

class OpenRouterProvider(OpenAIProvider):
    """
    OpenRouter provider (uses OpenAI SDK compatibility).
    Inherits from OpenAIProvider, just sets default base_url.
    """

    def __init__(
        self,
        api_key: str,
        model_name: str = "meta-llama/llama-3.1-8b-instruct:free",
        base_url: str = "https://openrouter.ai/api/v1",
    ) -> None:
        super().__init__(api_key, model_name, base_url)

    @property
    def provider_name(self) -> str:
        return "openrouter"


# ── Ollama Provider (BYO, local) ──────────────────────────────────────────────

class OllamaProvider(AIProvider):
    """
    Ollama provider using httpx to talk to local Ollama API.
    """

    def __init__(
        self,
        model_name: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self._base_url = base_url or settings.OLLAMA_URL
        self._model_name = model_name or settings.OLLAMA_MODEL
        self._validate_config()

    def _validate_config(self) -> None:
        if not self._model_name:
            raise AIConfigurationError("Ollama model name is required.")
        if not self._base_url:
            raise AIConfigurationError("Ollama base URL is required.")

    @property
    def provider_name(self) -> str:
        return "ollama"

    @property
    def model_name(self) -> str:
        return self._model_name

    async def generate(self, prompt: str, context: str | None = None) -> tuple[str, int | None]:
        try:
            import httpx
            full_prompt = self._build_prompt(prompt, context)
            async with httpx.AsyncClient(timeout=float(settings.OLLAMA_TIMEOUT)) as client:
                response = await client.post(
                    f"{self._base_url}/api/generate",
                    json={
                        "model": self._model_name,
                        "prompt": full_prompt,
                        "stream": False,
                        "options": {
                            "temperature": settings.TEMPERATURE,
                            "num_predict": settings.MAX_TOKENS,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("response", ""), None
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def generate_json(
        self,
        prompt: str,
        context: str | None = None,
    ) -> tuple[dict[str, Any], int | None]:
        try:
            import httpx
            json_instruction = (
                "\n\nIMPORTANT: Your response must be valid JSON only. "
                "Do not include markdown fences, explanations, or any text outside the JSON object."
            )
            full_prompt = self._build_prompt(prompt + json_instruction, context)
            async with httpx.AsyncClient(timeout=float(settings.OLLAMA_TIMEOUT)) as client:
                response = await client.post(
                    f"{self._base_url}/api/generate",
                    json={
                        "model": self._model_name,
                        "prompt": full_prompt,
                        "stream": False,
                        "format": "json",
                        "options": {
                            "temperature": settings.TEMPERATURE,
                            "num_predict": settings.MAX_TOKENS,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()
                text = data.get("response", "")
                parsed = json.loads(text)
                return parsed, None
        except json.JSONDecodeError as exc:
            raise AIInvalidResponseError(
                f"Ollama returned non-JSON content: {exc}"
            ) from exc
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def chat(
        self,
        messages: list[dict[str, str]],
        context: str | None = None,
    ) -> tuple[str, int | None]:
        try:
            import httpx
            final_messages = []
            if context:
                final_messages.append({"role": "system", "content": context})
            final_messages.extend(messages)
            async with httpx.AsyncClient(timeout=float(settings.OLLAMA_TIMEOUT)) as client:
                response = await client.post(
                    f"{self._base_url}/api/chat",
                    json={
                        "model": self._model_name,
                        "messages": final_messages,
                        "stream": False,
                        "options": {
                            "temperature": settings.TEMPERATURE,
                            "num_predict": settings.MAX_TOKENS,
                        },
                    },
                )
                response.raise_for_status()
                data = response.json()
                return data.get("message", {}).get("content", ""), None
        except Exception as exc:
            self._handle_provider_error(exc)
            raise  # Unreachable, but mypy needs this

    async def list_models(self) -> list[str]:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self._base_url}/api/tags")
                response.raise_for_status()
                data = response.json()
                return [model["name"] for model in data.get("models", [])]
        except Exception as exc:
            logger.error("Failed to list Ollama models: %s", exc)
            return ["llama3.2", "llama3.1", "mistral"]

    async def health_check(self) -> bool:
        try:
            response = await self.generate("Say 'OK'")
            return "OK" in response[0]
        except Exception:
            return False

    @staticmethod
    def _build_prompt(prompt: str, context: str | None) -> str:
        if context:
            return f"[Context]\n{context}\n\n[Request]\n{prompt}"
        return prompt

    @staticmethod
    def _handle_provider_error(exc: Exception) -> None:
        import httpx
        traceback.print_exc()
        logger.error("[DEBUG] Original exception repr: %s", repr(exc))
        if isinstance(exc, httpx.TimeoutException):
            raise AITimeoutError() from exc
        if isinstance(exc, httpx.HTTPStatusError):
            if exc.response.status_code == 429:
                raise AIRateLimitError() from exc
            if exc.response.status_code in (401, 403):
                raise AIConfigurationError("Authentication failed with Ollama.") from exc
        logger.exception("Unhandled Ollama error: %s", exc)
        raise AIProviderError(f"Ollama provider error: {type(exc).__name__}") from exc


# ── Provider registry & factory ───────────────────────────────────────────────

PROVIDER_REGISTRY: dict[str, type[AIProvider]] = {
    "gemini": GeminiProvider,
    "openai": OpenAIProvider,
    "claude": ClaudeProvider,
    "openrouter": OpenRouterProvider,
    "ollama": OllamaProvider,
}


def get_provider_for_settings(
    mode: str = "cloud",
    provider: str | None = None,
    encrypted_api_key: str | None = None,
    base_url: str | None = None,
    model_name: str | None = None,
) -> AIProvider:
    """
    Factory function to get an AI provider instance based on user settings.
    Modified to force Ollama as the only active provider for development.
    """
    return OllamaProvider(
        model_name=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_URL,
    )


def get_provider() -> AIProvider:
    """
    Factory function — returns the configured AIProvider instance.
    Modified to force Ollama as the only active provider for development.
    """
    return OllamaProvider(
        model_name=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_URL,
    )
