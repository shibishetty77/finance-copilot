"""
AI module — conversation context management.

This is the memory layer for multi-turn AI conversations.
Currently a lightweight placeholder; will be expanded when the AI Assistant
feature is built.

Future roadmap:
  - Persist conversation history to the database per user.
  - Support context windowing (trim old messages when token limit is reached).
  - Add user-scoped memory (preferences, financial goals, recurring patterns).

Usage:
    ctx = ConversationContext(user_id="abc123")
    ctx.add_message("user", "What did I spend most on last month?")
    ctx.add_message("assistant", "Your top category was Food & Dining (₹8,400).")
    messages = ctx.get_messages()   # pass to AIService.chat()
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any, Literal


@dataclass
class ContextMessage:
    """A single message in a conversation context."""

    role: Literal["user", "assistant", "system"]
    content: str
    timestamp: datetime = field(default_factory=lambda: datetime.now(UTC))

    def to_dict(self) -> dict[str, str]:
        """Serialise to the format expected by AIProvider.chat()."""
        return {"role": self.role, "content": self.content}


class ConversationContext:
    """
    Lightweight in-memory conversation context for a single user session.

    Holds an ordered history of messages and enforces a max window size so
    token budgets are not exceeded.

    Args:
        user_id:     The authenticated user this context belongs to.
        max_messages: Maximum number of messages to retain (older messages
                     are dropped when the window is full).
        system_prompt: Optional system-level instruction injected at the start
                       of every conversation.
    """

    def __init__(
        self,
        user_id: str,
        max_messages: int = 20,
        system_prompt: str | None = None,
    ) -> None:
        self.user_id = user_id
        self.max_messages = max_messages
        self._messages: list[ContextMessage] = []

        if system_prompt:
            self._messages.append(
                ContextMessage(role="system", content=system_prompt)
            )

    # ── Message management ────────────────────────────────────────────────────

    def add_message(self, role: Literal["user", "assistant", "system"], content: str) -> None:
        """
        Append a message to the context.

        If the history exceeds max_messages, the oldest non-system message
        is removed to stay within the window.
        """
        self._messages.append(ContextMessage(role=role, content=content))
        self._trim()

    def get_messages(self) -> list[dict[str, str]]:
        """
        Return messages in the format expected by AIProvider.chat().

        Returns:
            List of {"role": str, "content": str} dicts.
        """
        return [m.to_dict() for m in self._messages]

    def get_last_n(self, n: int) -> list[dict[str, str]]:
        """Return the last N messages as dicts."""
        return [m.to_dict() for m in self._messages[-n:]]

    def clear(self) -> None:
        """Reset the conversation history (retains system prompt if set)."""
        system_msgs = [m for m in self._messages if m.role == "system"]
        self._messages = system_msgs

    @property
    def message_count(self) -> int:
        """Total number of messages in the context (including system)."""
        return len(self._messages)

    def to_dict(self) -> dict[str, Any]:
        """Serialise the full context to a dict (useful for debugging/logging)."""
        return {
            "user_id": self.user_id,
            "message_count": self.message_count,
            "messages": self.get_messages(),
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    def _trim(self) -> None:
        """
        Enforce max_messages window.

        System messages are always preserved. When over budget, remove the
        oldest non-system messages first.
        """
        while len(self._messages) > self.max_messages:
            # Find and remove the oldest non-system message
            for i, msg in enumerate(self._messages):
                if msg.role != "system":
                    self._messages.pop(i)
                    break
            else:
                # All messages are system messages — just trim from the end
                self._messages.pop()


# ── Context store (in-memory, session-scoped) ─────────────────────────────────


class ConversationContextStore:
    """
    Simple in-memory store mapping user_id → ConversationContext.

    One context per user. Future upgrade: Redis or DB-backed store.
    """

    def __init__(self) -> None:
        self._store: dict[str, ConversationContext] = {}

    def get_or_create(self, user_id: str, system_prompt: str | None = None) -> ConversationContext:
        """
        Return an existing context for the user, or create a new one.

        Args:
            user_id:       The user identifier.
            system_prompt: Only applied when creating a new context.

        Returns:
            The user's ConversationContext.
        """
        if user_id not in self._store:
            self._store[user_id] = ConversationContext(
                user_id=user_id,
                system_prompt=system_prompt,
            )
        return self._store[user_id]

    def clear(self, user_id: str) -> None:
        """Clear the conversation history for a user."""
        if user_id in self._store:
            self._store[user_id].clear()

    def delete(self, user_id: str) -> None:
        """Remove a user's context entirely."""
        self._store.pop(user_id, None)
