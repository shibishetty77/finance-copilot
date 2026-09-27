"""
AI module — HTTP router.

Registers the /api/v1/ai/* endpoints.

Endpoints:
  GET    /api/v1/ai/health              — Public. Returns provider + model status.
  POST   /api/v1/ai/generate            — Auth required. Runs a prompt through AIService.
  GET    /api/v1/ai/settings            — Auth required. Get user's AI settings.
  PUT    /api/v1/ai/settings            — Auth required. Update user's AI settings.
  POST   /api/v1/ai/test                — Auth required. Test AI settings.
  POST   /api/v1/ai/models              — Auth required. List available models.
  POST   /api/v1/ai/assistant/chat      — Auth required. Cortex AI chat.
  GET    /api/v1/ai/assistant/history   — Auth required. Load conversation history.
  DELETE /api/v1/ai/assistant/history   — Auth required. Clear conversation history.

The router is intentionally thin: no business logic here.
All AI work is delegated to AIService, AssistantService, or providers.
"""

import logging
import time

from fastapi import APIRouter, Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.encryption import encrypt_value, mask_api_key
from app.core.exceptions import UnauthorizedError
from app.core.security import verify_access_token
from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.modules.ai.exceptions import AIConfigurationError, AIProviderError
from app.modules.ai.providers import (
    AIProvider,
    get_provider,
    get_provider_for_settings,
    PROVIDER_REGISTRY,
)
from app.modules.ai.repository import AISettingsRepository
from app.modules.ai.schemas import (
    AIHealthResponse,
    AIRequest,
    AIResponse,
    AISettingsResponse,
    ListModelsRequest,
    ListModelsResponse,
    TestAISettingsRequest,
    TestAISettingsResponse,
    UpdateAISettingsRequest,
)
from app.modules.ai.service import AIService
from app.modules.ai.assistant_service import AssistantService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI"])
bearer_scheme = HTTPBearer(auto_error=False)

__all__ = ["router", "get_provider"]


# ── Auth dependency ───────────────────────────────────────────────────────────

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """Validate the bearer token and return the authenticated user ID."""
    if not credentials:
        raise UnauthorizedError("Authorization header missing")
    try:
        return verify_access_token(credentials.credentials)
    except JWTError as exc:
        raise UnauthorizedError("Invalid or expired access token") from exc


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


# ── GET /api/v1/ai/settings ───────────────────────────────────────────────────

@router.get(
    "/settings",
    response_model=AISettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Get AI settings",
    description="Get the current user's AI settings.",
)
async def get_ai_settings(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AISettingsResponse:
    repo = AISettingsRepository(db)
    settings_obj = await repo.get_or_create_default(user.id)
    
    return AISettingsResponse(
        mode=settings_obj.mode,
        provider=settings_obj.provider,
        masked_api_key=mask_api_key(settings_obj.encrypted_api_key),
        base_url=settings_obj.base_url,
        default_model=settings_obj.default_model,
        assistant_model=settings_obj.assistant_model,
        smart_entry_model=settings_obj.smart_entry_model,
        ocr_model=settings_obj.ocr_model,
        sms_model=settings_obj.sms_model,
        gmail_model=settings_obj.gmail_model,
        investment_advisor_model=settings_obj.investment_advisor_model,
        cloud_fallback_enabled=settings_obj.cloud_fallback_enabled,
    )


# ── PUT /api/v1/ai/settings ───────────────────────────────────────────────────

@router.put(
    "/settings",
    response_model=AISettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Update AI settings",
    description="Update the current user's AI settings.",
)
async def update_ai_settings(
    payload: UpdateAISettingsRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AISettingsResponse:
    repo = AISettingsRepository(db)
    encrypted_api_key = None
    if payload.api_key is not None:
        if payload.api_key:
            encrypted_api_key = encrypt_value(payload.api_key)
        else:
            encrypted_api_key = ""
    
    settings_obj = await repo.update(
        user_id=user.id,
        mode=payload.mode,
        provider=payload.provider,
        encrypted_api_key=encrypted_api_key,
        base_url=payload.base_url,
        default_model=payload.default_model,
        assistant_model=payload.assistant_model,
        smart_entry_model=payload.smart_entry_model,
        ocr_model=payload.ocr_model,
        sms_model=payload.sms_model,
        gmail_model=payload.gmail_model,
        investment_advisor_model=payload.investment_advisor_model,
        cloud_fallback_enabled=payload.cloud_fallback_enabled,
    )
    await db.commit()
    await db.refresh(settings_obj)
    
    return AISettingsResponse(
        mode=settings_obj.mode,
        provider=settings_obj.provider,
        masked_api_key=mask_api_key(settings_obj.encrypted_api_key),
        base_url=settings_obj.base_url,
        default_model=settings_obj.default_model,
        assistant_model=settings_obj.assistant_model,
        smart_entry_model=settings_obj.smart_entry_model,
        ocr_model=settings_obj.ocr_model,
        sms_model=settings_obj.sms_model,
        gmail_model=settings_obj.gmail_model,
        investment_advisor_model=settings_obj.investment_advisor_model,
        cloud_fallback_enabled=settings_obj.cloud_fallback_enabled,
    )


# ── POST /api/v1/ai/test ──────────────────────────────────────────────────────

@router.post(
    "/test",
    response_model=TestAISettingsResponse,
    status_code=status.HTTP_200_OK,
    summary="Test AI settings",
    description="Test the given AI settings by making a small generation request.",
)
async def test_ai_settings(
    payload: TestAISettingsRequest,
) -> TestAISettingsResponse:
    start_time = time.time()
    provider: AIProvider | None = None
    try:
        if payload.mode == "cloud":
            provider = get_provider_for_settings(mode="cloud")
        else:
            if not payload.provider:
                raise AIConfigurationError("Provider is required for BYO mode")
            encrypted_key = encrypt_value(payload.api_key) if payload.api_key else None
            provider = get_provider_for_settings(
                mode="byok",
                provider=payload.provider,
                encrypted_api_key=encrypted_key,
                base_url=payload.base_url,
                model_name=payload.model,
            )
        
        healthy = await provider.health_check()
        latency = (time.time() - start_time) * 1000
        
        if healthy:
            return TestAISettingsResponse(
                connected=True,
                provider=provider.provider_name,
                model=provider.model_name,
                latency_ms=round(latency, 2),
                status="Success",
                error=None,
            )
        else:
            return TestAISettingsResponse(
                connected=False,
                provider=provider.provider_name,
                model=provider.model_name,
                latency_ms=round(latency, 2),
                status="Failed",
                error="Health check failed",
            )
    except Exception as exc:
        latency = (time.time() - start_time) * 1000
        logger.exception("AI settings test failed")
        return TestAISettingsResponse(
            connected=False,
            provider=payload.provider if payload.mode == "byok" else settings.AI_PROVIDER,
            model=payload.model,
            latency_ms=round(latency, 2),
            status="Error",
            error=str(exc),
        )


# ── POST /api/v1/ai/models ────────────────────────────────────────────────────

@router.post(
    "/models",
    response_model=ListModelsResponse,
    status_code=status.HTTP_200_OK,
    summary="List available models",
    description="List available models for a given provider.",
)
async def list_ai_models(
    payload: ListModelsRequest,
) -> ListModelsResponse:
    try:
        if payload.provider in PROVIDER_REGISTRY:
            provider_class = PROVIDER_REGISTRY[payload.provider]
            if payload.provider == "ollama":
                provider = provider_class(base_url=payload.base_url)  # type: ignore[call-arg]
            else:
                encrypted_key = encrypt_value(payload.api_key) if payload.api_key else None
                provider = get_provider_for_settings(
                    mode="byok",
                    provider=payload.provider,
                    encrypted_api_key=encrypted_key,
                    base_url=payload.base_url,
                )
            models = await provider.list_models()
            return ListModelsResponse(models=models)
        else:
            return ListModelsResponse(models=[])
    except Exception as exc:
        logger.exception("Failed to list models")
        return ListModelsResponse(models=[])


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
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AIResponse:
    """
    Send a prompt to the AI provider and return the generated response.

    Requires a valid Bearer token. The user_id is extracted from the token
    and used only for logging/future per-user rate limiting.

    Args:
        payload:  AIRequest containing the prompt and optional context.
        user:     Current user (injected by FastAPI).
        db:       Database session (injected by FastAPI).

    Returns:
        AIResponse with response text, provider metadata, and latency.
    """
    logger.debug("AI generate | user=%s prompt_len=%s", user.id, len(payload.prompt))
    
    # Get user's AI settings
    repo = AISettingsRepository(db)
    ai_settings = await repo.get_or_create_default(user.id)
    
    provider: AIProvider
    try:
        provider = get_provider_for_settings(
            mode=ai_settings.mode,
            provider=ai_settings.provider,
            encrypted_api_key=ai_settings.encrypted_api_key,
            base_url=ai_settings.base_url,
            model_name=ai_settings.default_model,
        )
    except (AIConfigurationError, AIProviderError) as exc:
        if ai_settings.cloud_fallback_enabled:
            logger.warning("Falling back to cloud provider: %s", exc)
            provider = get_provider_for_settings(mode="cloud")
        else:
            raise
    
    svc = AIService(provider)
    return await svc.generate_text(payload.prompt, payload.context)


# ── Assistant schemas (inline — avoid a separate schema file) ─────────────────

from pydantic import BaseModel as _BaseModel

class AssistantChatRequest(_BaseModel):
    """Request body for Cortex chat endpoint."""
    message: str
    conversation_id: str | None = None


class AssistantChatResponse(_BaseModel):
    """Response from Cortex."""
    response: str
    conversation_id: str
    latency_ms: float
    error: str | None = None


class AssistantHistoryMessage(_BaseModel):
    id: str
    role: str
    content: str
    created_at: str


class AssistantHistoryResponse(_BaseModel):
    messages: list[AssistantHistoryMessage]
    conversation_id: str


class ClearHistoryResponse(_BaseModel):
    deleted: int
    conversation_id: str


# ── Helper: build provider from user AI settings ──────────────────────────────

async def _get_provider_for_user(
    user: User,
    db: AsyncSession,
) -> AIProvider:
    """Resolve the correct AI provider for the given user's settings."""
    repo = AISettingsRepository(db)
    ai_settings = await repo.get_or_create_default(user.id)
    try:
        return get_provider_for_settings(
            mode=ai_settings.mode,
            provider=ai_settings.provider,
            encrypted_api_key=ai_settings.encrypted_api_key,
            base_url=ai_settings.base_url,
            model_name=ai_settings.assistant_model or ai_settings.default_model,
        )
    except (AIConfigurationError, AIProviderError) as exc:
        if ai_settings.cloud_fallback_enabled:
            logger.warning("Assistant: falling back to cloud provider: %s", exc)
            return get_provider_for_settings(mode="cloud")
        raise


# ── POST /api/v1/ai/assistant/chat ────────────────────────────────────────────

@router.post(
    "/assistant/chat",
    response_model=AssistantChatResponse,
    status_code=status.HTTP_200_OK,
    summary="Cortex — send a message",
    description=(
        "Send a natural-language question about your finances. "
        "The assistant queries only the relevant data and answers using your real figures."
    ),
)
async def assistant_chat(
    payload: AssistantChatRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssistantChatResponse:
    """
    Process one user message through Cortex.

    The assistant:
      1. Fetches relevant financial data (spending, categories, goals, etc.)
      2. Builds a compact context for the LLM.
      3. Calls Ollama via AIService.chat() with the full conversation history.
      4. Persists the exchange to the database.
    """
    logger.debug("Assistant chat | user=%s msg_len=%s", user.id, len(payload.message))

    provider = await _get_provider_for_user(user, db)
    svc = AssistantService(
        provider=provider,
        db=db,
        user_id=str(user.id),
        conversation_id=payload.conversation_id,
    )
    result = await svc.chat(payload.message)
    return AssistantChatResponse(
        response=result["response"],
        conversation_id=result["conversation_id"],
        latency_ms=result.get("latency_ms", 0),
        error=result.get("error"),
    )


# ── GET /api/v1/ai/assistant/history ─────────────────────────────────────────

@router.get(
    "/assistant/history",
    response_model=AssistantHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Cortex — load conversation history",
    description="Return the full conversation history for the current user.",
)
async def get_assistant_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AssistantHistoryResponse:
    """Load all persisted chat messages for this user's conversation."""
    from app.modules.ai.assistant_service import AssistantRepository
    repo = AssistantRepository(db)
    user_id = str(user.id)
    messages = await repo.get_all_messages(user_id, conversation_id=user_id)
    return AssistantHistoryResponse(
        messages=[AssistantHistoryMessage(**m) for m in messages],
        conversation_id=user_id,
    )


# ── DELETE /api/v1/ai/assistant/history ───────────────────────────────────────

@router.delete(
    "/assistant/history",
    response_model=ClearHistoryResponse,
    status_code=status.HTTP_200_OK,
    summary="Cortex — clear conversation history",
    description="Delete all chat messages for the current user.",
)
async def clear_assistant_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ClearHistoryResponse:
    """Clear the user's conversation history."""
    from app.modules.ai.assistant_service import AssistantRepository
    repo = AssistantRepository(db)
    user_id = str(user.id)
    count = await repo.clear_history(user_id, conversation_id=user_id)
    return ClearHistoryResponse(deleted=count, conversation_id=user_id)
