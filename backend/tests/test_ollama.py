"""
tests/test_ollama.py

Integration tests for the Ollama AI backend.

Verifies:
  ✓ Ollama server is reachable at localhost:11434
  ✓ llama3.2:3b model is available
  ✓ OllamaProvider.health_check() returns True
  ✓ AIService.generate_text() returns valid text
  ✓ AIService.generate_structured() returns valid JSON
  ✓ SMS parsing returns expected fields
  ✓ Receipt text structuring returns expected fields
  ✓ Proper errors are returned when Ollama is unavailable

Run with:
    cd backend
    .venv\\Scripts\\python -m pytest tests/test_ollama.py -v
"""

import httpx
import pytest

from app.config import settings
from app.modules.ai.exceptions import (
    AIProviderError,
    AITimeoutError,
)
from app.modules.ai.providers import OllamaProvider
from app.modules.ai.service import AIService


# ── Helpers ────────────────────────────────────────────────────────────────────


def _ollama_running() -> bool:
    """Return True if the Ollama server is reachable."""
    try:
        response = httpx.get(f"{settings.OLLAMA_URL}/api/tags", timeout=5.0)
        return response.status_code == 200
    except Exception:
        return False


def _model_available() -> bool:
    """Return True if the configured model is listed in Ollama."""
    try:
        response = httpx.get(f"{settings.OLLAMA_URL}/api/tags", timeout=5.0)
        if response.status_code != 200:
            return False
        data = response.json()
        names = [m["name"] for m in data.get("models", [])]
        return any(settings.OLLAMA_MODEL in name for name in names)
    except Exception:
        return False


# Skip all tests gracefully if Ollama isn't running.
pytestmark = pytest.mark.skipif(
    not _ollama_running(),
    reason="Ollama server not running at localhost:11434 — start with `ollama serve`",
)


# ── Fixtures ───────────────────────────────────────────────────────────────────


@pytest.fixture
def provider() -> OllamaProvider:
    """Return an OllamaProvider wired to the configured model."""
    return OllamaProvider(
        model_name=settings.OLLAMA_MODEL,
        base_url=settings.OLLAMA_URL,
    )


@pytest.fixture
def ai_service(provider: OllamaProvider) -> AIService:
    """Return an AIService backed by the Ollama provider."""
    return AIService(provider)


# ── Test 1: Server connection ──────────────────────────────────────────────────


def test_ollama_server_is_reachable() -> None:
    """Verify the Ollama HTTP server responds on the configured URL."""
    assert _ollama_running(), (
        f"Ollama server not reachable at {settings.OLLAMA_URL}. "
        "Run `ollama serve` to start it."
    )


# ── Test 2: Model availability ─────────────────────────────────────────────────


def test_configured_model_is_available() -> None:
    """Verify that the configured model is pulled and listed in Ollama."""
    assert _model_available(), (
        f"Model '{settings.OLLAMA_MODEL}' is not available in Ollama. "
        f"Run `ollama pull {settings.OLLAMA_MODEL}` to download it."
    )


# ── Test 3: Health check ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_ollama_provider_health_check(provider: OllamaProvider) -> None:
    """OllamaProvider.health_check() should return True against the live model."""
    healthy = await provider.health_check()
    assert healthy, (
        f"Health check failed for {settings.OLLAMA_MODEL} at {settings.OLLAMA_URL}"
    )


# ── Test 4: Plain text generation ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_text(ai_service: AIService) -> None:
    """AIService.generate_text() should return a non-empty response."""
    response = await ai_service.generate_text("Say 'hello' in one word.")
    assert response.response, "Expected a non-empty text response"
    assert response.provider == "ollama"
    assert response.model == settings.OLLAMA_MODEL
    assert response.latency_ms > 0


# ── Test 5: Structured JSON generation ────────────────────────────────────────


@pytest.mark.asyncio
async def test_generate_structured_returns_valid_dict(ai_service: AIService) -> None:
    """AIService.generate_structured() should return a parsed dict."""
    prompt = (
        'Extract the following into JSON with keys "name" and "amount": '
        '"Paid Rs 500 to Swiggy"'
    )
    response = await ai_service.generate_structured(prompt)
    assert isinstance(response.data, dict), "Expected a dict from generate_structured"
    assert response.provider == "ollama"


# ── Test 6: SMS parsing ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sms_parsing_end_to_end(ai_service: AIService) -> None:
    """Full SMS -> structured transaction flow using the real prompt template."""
    from datetime import date

    from app.modules.message_parser.prompts import sms_parser_prompt

    sms = (
        "HDFC Bank: INR 1,200.00 debited from A/c XX1234 on 01-Aug-26 "
        "to Zomato. Avl Bal: INR 15,000.00. If not done by you, call 1800-202-6161."
    )
    prompt = sms_parser_prompt(sms, date.today().isoformat())
    schema = {"required": ["confidence"]}

    response = await ai_service.generate_structured(prompt=prompt, schema=schema)
    data = response.data

    assert isinstance(data.get("confidence"), (int, float)), (
        "Expected 'confidence' field in SMS parse response"
    )
    tx_type = data.get("transaction_type", "").lower()
    assert tx_type in ("expense", "income", ""), (
        f"Unexpected transaction_type: '{tx_type}'"
    )


# ── Test 7: Receipt text structuring ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_receipt_text_structuring(ai_service: AIService) -> None:
    """OCR text -> structured receipt flow using the real prompt template."""
    from app.modules.ai.prompt_templates import receipt_prompt

    ocr_text = (
        "Swiggy\n"
        "Order #SW98765\n"
        "Date: 01 Aug 2026\n"
        "Chicken Biryani x1    Rs 280\n"
        "Delivery Fee          Rs 40\n"
        "GST                   Rs 16\n"
        "Total                 Rs 336\n"
        "Paid via UPI"
    )
    prompt = receipt_prompt(ocr_text)
    response = await ai_service.generate_structured(prompt)
    data = response.data

    assert isinstance(data, dict), "Expected a dict from receipt structuring"
    found_keys = {"merchant_name", "total_amount", "date", "payment_method"} & data.keys()
    assert found_keys, (
        f"No expected receipt fields found. Got keys: {list(data.keys())}"
    )


# ── Test 8: Error — wrong model ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_error_when_model_not_found() -> None:
    """Requesting a non-existent model should raise AIProviderError, not crash."""
    bad_provider = OllamaProvider(
        model_name="nonexistent-model-xyz:99b",
        base_url=settings.OLLAMA_URL,
    )
    svc = AIService(bad_provider)
    with pytest.raises((AIProviderError, AITimeoutError)):
        await svc.generate_text("Hello")


# ── Test 9: Error — server unavailable ────────────────────────────────────────


@pytest.mark.asyncio
async def test_error_when_server_unavailable() -> None:
    """Pointing at a dead URL should raise AIProviderError with a clear message."""
    dead_provider = OllamaProvider(
        model_name=settings.OLLAMA_MODEL,
        base_url="http://localhost:19999",  # nothing listening here
    )
    svc = AIService(dead_provider)
    with pytest.raises((AIProviderError, AITimeoutError)):
        await svc.generate_text("Hello")
