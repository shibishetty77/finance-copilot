"""
AI Finance Assistant — orchestration service.

Handles the full chat lifecycle:
  1. Load recent conversation history from the database.
  2. Build a compact financial context for the current question.
  3. Call AIService.chat() with the full message history + system prompt.
  4. Persist the new user + assistant messages to the database.
  5. Return the assistant's reply.

Architecture rule: This service MUST NOT import ORM models directly.
All DB access goes through either AssistantRepository or assistant_context_tools.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat_message import ChatMessage
from app.modules.ai.assistant_context_tools import build_financial_context
from app.modules.ai.exceptions import AIProviderError, AITimeoutError
from app.modules.ai.prompt_templates import finance_assistant_system_prompt
from app.modules.ai.providers import AIProvider
from app.modules.ai.schemas import ChatMessage as ChatMessageSchema
from app.modules.ai.service import AIService

logger = logging.getLogger(__name__)

# Number of previous messages to include in the chat context window.
_HISTORY_WINDOW = 10


# ── Chat history repository ───────────────────────────────────────────────────

class AssistantRepository:
    """Database operations for chat message persistence."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_history(
        self,
        user_id: str,
        conversation_id: str,
        limit: int = _HISTORY_WINDOW,
    ) -> list[ChatMessage]:
        """Return the last N messages for this conversation, oldest first."""
        # Subquery: get the last `limit` message IDs ordered by created_at desc
        inner = (
            select(ChatMessage.id)
            .where(
                and_(
                    ChatMessage.user_id == user_id,
                    ChatMessage.conversation_id == conversation_id,
                )
            )
            .order_by(ChatMessage.created_at.desc())
            .limit(limit)
            .subquery()
        )
        query = (
            select(ChatMessage)
            .where(ChatMessage.id.in_(select(inner.c.id)))
            .order_by(ChatMessage.created_at.asc())
        )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def save_message(
        self,
        user_id: str,
        conversation_id: str,
        role: str,
        content: str,
    ) -> ChatMessage:
        """Persist a single message."""
        msg = ChatMessage(
            id=str(uuid.uuid4()),
            user_id=user_id,
            conversation_id=conversation_id,
            role=role,
            content=content,
        )
        self.db.add(msg)
        await self.db.flush()
        return msg

    async def clear_history(self, user_id: str, conversation_id: str) -> int:
        """Delete all messages for this conversation. Returns count deleted."""
        result = await self.db.execute(
            delete(ChatMessage).where(
                and_(
                    ChatMessage.user_id == user_id,
                    ChatMessage.conversation_id == conversation_id,
                )
            )
        )
        await self.db.commit()
        return result.rowcount or 0

    async def get_all_messages(
        self,
        user_id: str,
        conversation_id: str,
    ) -> list[dict[str, Any]]:
        """Return all messages as plain dicts (for the frontend history endpoint)."""
        query = (
            select(ChatMessage)
            .where(
                and_(
                    ChatMessage.user_id == user_id,
                    ChatMessage.conversation_id == conversation_id,
                )
            )
            .order_by(ChatMessage.created_at.asc())
        )
        result = await self.db.execute(query)
        msgs = result.scalars().all()
        return [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in msgs
        ]


# ── Assistant service ─────────────────────────────────────────────────────────

class AssistantService:
    """
    Orchestrates the full AI Finance Assistant chat flow.

    Args:
        provider:         Injected AIProvider (Ollama / other).
        db:               Async database session.
        user_id:          Authenticated user ID.
        conversation_id:  Session identifier (defaults to user_id for simplicity).
    """

    def __init__(
        self,
        provider: AIProvider,
        db: AsyncSession,
        user_id: str,
        conversation_id: str | None = None,
    ) -> None:
        self._ai = AIService(provider)
        self._repo = AssistantRepository(db)
        self._db = db
        self._user_id = user_id
        # Default: one conversation per user.  Future: per-session UUIDs.
        self._conv_id = conversation_id or user_id

    async def chat(self, user_message: str) -> dict[str, Any]:
        """
        Process one user message and return the assistant's response.

        Returns:
            {
                "response":        str,   # assistant's text
                "conversation_id": str,   # for frontend to track sessions
                "latency_ms":      float,
            }
        """
        # 1. Load conversation history from DB
        history = await self._repo.get_history(self._user_id, self._conv_id)

        # 2. Convert history to list of dicts for tool selection
        history_dicts = [{"role": h.role, "content": h.content} for h in history]

        # 3. Build financial context for this specific question
        financial_context = await build_financial_context(
            self._db, self._user_id, user_message, self._ai, history_dicts
        )

        # 4. Build the message list for the chat call
        system_prompt = finance_assistant_system_prompt()
        messages: list[ChatMessageSchema] = []

        # History (user + assistant alternating, no system messages)
        for h in history:
            if h.role in ("user", "assistant"):
                messages.append(ChatMessageSchema(role=h.role, content=h.content))

        # Append the new user question
        messages.append(ChatMessageSchema(role="user", content=user_message))

        # 5. Call AIService.chat() — system prompt goes as the `context` arg
        #    which the Ollama provider inserts as a system message automatically.
        full_context = f"{system_prompt}\n\n{financial_context}"

        try:
            chat_response = await self._ai.chat(messages, context=full_context)
        except AITimeoutError:
            logger.warning("Ollama timed out for user %s", self._user_id)
            return {
                "response": (
                    "I'm sorry, the AI model is taking too long to respond right now. "
                    "Please try again in a moment. If this keeps happening, check that "
                    "Ollama is running with `ollama serve`."
                ),
                "conversation_id": self._conv_id,
                "latency_ms": 0,
                "error": "timeout",
            }
        except AIProviderError as exc:
            logger.warning("AI provider error for user %s: %s", self._user_id, exc)
            return {
                "response": (
                    "I'm having trouble connecting to the AI model right now. "
                    "Please make sure Ollama is running and try again."
                ),
                "conversation_id": self._conv_id,
                "latency_ms": 0,
                "error": "provider_error",
            }
        except Exception as exc:
            logger.exception("Unexpected error in AssistantService.chat: %s", exc)
            return {
                "response": "I encountered an unexpected error. Please try again.",
                "conversation_id": self._conv_id,
                "latency_ms": 0,
                "error": "unexpected_error",
            }

        # 6. Persist user + assistant messages
        await self._repo.save_message(
            self._user_id, self._conv_id, "user", user_message
        )
        await self._repo.save_message(
            self._user_id, self._conv_id, "assistant", chat_response.response
        )
        await self._db.commit()

        return {
            "response": chat_response.response,
            "conversation_id": self._conv_id,
            "latency_ms": chat_response.latency_ms,
        }

    async def get_history(self) -> list[dict[str, Any]]:
        """Return the full conversation history for the frontend."""
        return await self._repo.get_all_messages(self._user_id, self._conv_id)

    async def clear_history(self) -> dict[str, Any]:
        """Delete all messages in this conversation."""
        count = await self._repo.clear_history(self._user_id, self._conv_id)
        return {"deleted": count, "conversation_id": self._conv_id}
