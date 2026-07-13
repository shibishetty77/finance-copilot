"""
AI module — exception hierarchy.

All AI-related errors extend AppException so the existing
app_exception_handler in core/exceptions.py will catch them cleanly.
Provider-specific exceptions are never allowed to bubble up to the API layer.
"""

from fastapi import status

from app.core.exceptions import AppException


# ── AI-specific exceptions ────────────────────────────────────────────────────


class AIProviderError(AppException):
    """
    General failure from the AI provider (e.g. API error, unexpected response).

    Raised when the provider returns an error that is not covered by more
    specific sub-exceptions.
    """

    def __init__(self, message: str = "AI provider error") -> None:
        super().__init__(
            message=message,
            code="AI_PROVIDER_ERROR",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )


class AIConfigurationError(AppException):
    """
    Raised when the AI module is misconfigured.

    Typical causes:
      - Missing or empty API key
      - Unsupported provider name in AI_PROVIDER env var
    """

    def __init__(self, message: str = "AI is not configured correctly") -> None:
        super().__init__(
            message=message,
            code="AI_CONFIGURATION_ERROR",
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class AITimeoutError(AppException):
    """
    Raised when the AI provider does not respond within the configured timeout.
    """

    def __init__(self, message: str = "AI provider request timed out") -> None:
        super().__init__(
            message=message,
            code="AI_TIMEOUT",
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
        )


class AIRateLimitError(AppException):
    """
    Raised when the AI provider returns a rate limit (429) response.
    """

    def __init__(self, message: str = "AI provider rate limit exceeded") -> None:
        super().__init__(
            message=message,
            code="AI_RATE_LIMIT",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )


class AIInvalidResponseError(AppException):
    """
    Raised when the AI provider returns a response that cannot be parsed.

    Typical causes:
      - Provider returned non-JSON when JSON was expected
      - JSON schema validation failed
    """

    def __init__(self, message: str = "AI provider returned an invalid response") -> None:
        super().__init__(
            message=message,
            code="AI_INVALID_RESPONSE",
            status_code=status.HTTP_502_BAD_GATEWAY,
        )
