"""
AI module — HTTP router.

Registers the /api/v1/ai/* endpoints.

Endpoints:
  GET  /api/v1/ai/health    — Public. Returns provider + model status.
  POST /api/v1/ai/generate  — Auth required. Runs a prompt through AIService.

The router is intentionally thin: no business logic here.
All AI work is delegated to AIService.
"""

import logging

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.config import settings
from app.core.exceptions import UnauthorizedError
from app.core.security import verify_access_token
from app.modules.ai.exceptions import AIConfigurationError
from app.modules.ai.providers import AIProvider, get_provider
from app.modules.ai.schemas import AIHealthResponse, AIRequest, AIResponse
from app.modules.ai.service import AIService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])
bearer_scheme = HTTPBearer(auto_error=False)


# ── Auth dependency ───────────────────────────────────────────────────────────


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """Extract and validate the Bearer token, return the user ID string."""
    if not credentials:
        raise UnauthorizedError("Authorization header missing")
    try:
        user_id = verify_access_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Invalid or expired access token")
    return user_id


# ── GET /api/v1/ai/health ─────────────────────────────────────────────────────


@router.get(
    "/health",
    response_model=AIHealthResponse,
    status_code=status.HTTP_200_OK,
    summary="AI layer health check",
    description=(
        "Public endpoint. Returns the configured provider and model, plus "
        "a 'ready' or 'misconfigured' status. Does NOT call the LLM."
    ),
)
async def ai_health() -> AIHealthResponse:
    """
    Check whether the AI layer is correctly configured.

    Does not require authentication. Does not make an external API call.
    Simply validates that the provider and API key are in place.
    """
    provider_name = settings.AI_PROVIDER
    model_name = settings.MODEL_NAME

    # Try to instantiate the provider — catches missing keys and bad config.
    try:
        get_provider()
        ai_status: str = "ready"
    except AIConfigurationError as exc:
        logger.warning("AI health check: misconfigured — %s", exc.message)
        ai_status = "misconfigured"

    return AIHealthResponse(
        provider=provider_name,
        model=model_name,
        status=ai_status,  # type: ignore[arg-type]
    )


# ── POST /api/v1/ai/generate ──────────────────────────────────────────────────


@router.post(
    "/generate",
    response_model=AIResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate AI text",
    description=(
        "Authenticated endpoint. Sends a prompt to the configured AI provider "
        "and returns the generated text along with usage metadata."
    ),
)
async def ai_generate(
    payload: AIRequest,
    user_id: str = Depends(get_current_user_id),
    provider: AIProvider = Depends(get_provider),
) -> AIResponse:
    """
    Send a prompt to the AI provider and return the generated response.

    Requires a valid Bearer token. The user_id is extracted from the token
    and used only for logging/future per-user rate limiting.

    Args:
        payload:  AIRequest containing the prompt and optional context.
        user_id:  Extracted from the Bearer token (injected by FastAPI).
        provider: Injected AIProvider instance (via get_provider).

    Returns:
        AIResponse with response text, provider metadata, and latency.
    """
    logger.debug("AI generate | user=%s prompt_len=%d", user_id, len(payload.prompt))
    svc = AIService(provider)
    return await svc.generate_text(payload.prompt, payload.context)
