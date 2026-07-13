"""
AI module — Pydantic request/response schemas.

These schemas define the contract between:
  - Frontend API client  ↔  AI router
  - AI router            ↔  AI service

Future AI features (OCR, SMS, Statement, etc.) will extend these base schemas
rather than defining their own raw dicts.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Request schemas ───────────────────────────────────────────────────────────


class AIRequest(BaseModel):
    """Plain text generation request."""

    prompt: str = Field(..., min_length=1, max_length=32_000, description="The prompt to send to the AI provider.")
    context: str | None = Field(None, max_length=8_000, description="Optional system-level context to prepend.")


class StructuredRequest(BaseModel):
    """Request for JSON-structured output from the AI provider."""

    prompt: str = Field(..., min_length=1, max_length=32_000)
    context: str | None = Field(None, max_length=8_000)
    response_schema: dict[str, Any] | None = Field(
        None,
        description="Optional JSON Schema to validate the AI's structured output against.",
    )


class ChatMessage(BaseModel):
    """A single message in a conversation thread."""

    role: Literal["user", "assistant", "system"] = Field(..., description="Who sent this message.")
    content: str = Field(..., min_length=1, max_length=32_000)


class ChatRequest(BaseModel):
    """Multi-turn conversation request."""

    messages: list[ChatMessage] = Field(..., min_length=1, description="Ordered list of conversation messages.")
    context: str | None = Field(None, max_length=8_000, description="Optional system-level context.")


# ── Response schemas ──────────────────────────────────────────────────────────


class AIResponse(BaseModel):
    """Response from a plain text generation call."""

    response: str = Field(..., description="The AI-generated text.")
    provider: str = Field(..., description="The provider used (e.g. 'gemini').")
    model: str = Field(..., description="The model used (e.g. 'gemini-2.5-flash').")
    tokens_used: int | None = Field(None, description="Total tokens consumed, if available.")
    latency_ms: float = Field(..., description="Round-trip latency in milliseconds.")


class StructuredResponse(BaseModel):
    """Response from a structured JSON generation call."""

    data: dict[str, Any] = Field(..., description="Parsed JSON object returned by the AI provider.")
    provider: str
    model: str
    tokens_used: int | None = None
    latency_ms: float


class ChatResponse(BaseModel):
    """Response from a chat/conversation call."""

    response: str = Field(..., description="The assistant's reply.")
    provider: str
    model: str
    tokens_used: int | None = None
    latency_ms: float


class AIHealthResponse(BaseModel):
    """Health check response for the AI layer."""

    provider: str = Field(..., description="Configured AI provider name.")
    model: str = Field(..., description="Configured model name.")
    status: Literal["ready", "misconfigured"] = Field(..., description="'ready' if the provider is usable.")
