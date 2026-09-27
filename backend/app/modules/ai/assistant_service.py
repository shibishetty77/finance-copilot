"""
Cortex AI Assistant — orchestration service.

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
from app.modules.ai.tools.market_apis import get_market_service
from app.modules.ai.exceptions import AIProviderError, AITimeoutError
from app.modules.ai.prompt_templates import finance_assistant_system_prompt
from app.modules.ai.providers import AIProvider
import re
from app.modules.ai.schemas import ChatMessage as ChatMessageSchema
from app.modules.ai.service import AIService

logger = logging.getLogger(__name__)

# Number of previous messages to include in the chat context window.
_HISTORY_WINDOW = 10


def _is_market_data_query(question: str) -> bool:
    """Detect if the question is asking for live market data (forex, crypto, stocks, commodities)."""
    question_lower = question.lower()
    
    # Market data patterns - these indicate live data requests
    market_patterns = [
        # Forex patterns
        "usd to inr", "dollar to rupee", "exchange rate", "forex", "currency rate",
        "eur to", "gbp to", "jpy to", "convert", "conversion",
        
        # Crypto patterns
        "bitcoin", "ethereum", "btc", "eth", "crypto", "cryptocurrency",
        "dogecoin", "solana", "cardano", "ripple", "xrp",
        
        # Commodity patterns
        "gold price", "silver price", "crude oil", "natural gas", "copper",
        "platinum", "palladium", "commodity",
        
        # Stock market patterns
        "nifty", "sensex", "stock price", "share price", "market price",
        "live price", "current price", "real-time", "today's rate",
        
        # General market patterns
        "market data", "live data", "current rate", "price of", "rate of",
    ]
    
    # Check if it's a market data query
    for pattern in market_patterns:
        if pattern in question_lower:
            return True
    
    return False


def _is_general_knowledge_question(question: str) -> bool:
    """Detect if the question is about general knowledge rather than finance."""
    question_lower = question.lower()
    
    # General knowledge patterns
    general_patterns = [
        "who is", "what is", "who was", "what was", 
        "tell me about", "explain", "define",
        "capital of", "population of", "history of",
        "meaning of", "how does", "why is"
    ]
    
    # Financial terms that override general patterns
    financial_terms = [
        "stock", "price", "market", "portfolio", "investment",
        "dividend", "share", "bond", "mutual fund", "etf",
        "gold", "silver", "commodity", "trading", "broker",
        "expense", "income", "budget", "savings", "goal",
        "transaction", "spending", "category", "tax"
    ]
    
    # Check if it's a general knowledge question
    for pattern in general_patterns:
        if pattern in question_lower:
            # But override if it contains financial terms
            for term in financial_terms:
                if term in question_lower:
                    return False
            return True
    
    return False


def _validate_market_response(response_text: str, context_text: str) -> bool:
    """Return False if the response contains numerical market claims not in the context."""
    market_keywords = ["Market Quote", "Stock Screener Results", "Historical Performance", "Company Info", "Holding Analysis", "Securities Comparison", "Company Performance"]
    if not any(k in context_text for k in market_keywords):
        return True
        
    # Extract numbers associated with currencies or percentages
    claims = re.findall(r'(?:₹|Rs\.?|INR|\$)\s*\d+(?:,\d+)*(?:\.\d+)?|\d+(?:,\d+)*(?:\.\d+)?\s*%', response_text)
    
    # Also extract stock tickers that are capitalized and end with .NS
    tickers = re.findall(r'[A-Z0-9-]+\.NS', response_text)
    
    norm_context = context_text.replace(",", "")
    context_numbers = []
    for match in re.findall(r'-?\d+(?:\.\d+)?', norm_context):
        try:
            context_numbers.append(float(match))
        except ValueError:
            pass

    for claim in claims:
        num_str = re.sub(r'[^\d.]', '', claim)
        if not num_str:
            continue
        try:
            val = float(num_str)
        except ValueError:
            continue
            
        found = False
        for c_val in context_numbers:
            if abs(c_val - val) < 0.05:
                found = True
                break
                
        if not found:
            logger.warning("Market validation failed: numerical claim %s not in context", claim)
            return False
            
    for ticker in tickers:
        if ticker not in context_text:
            logger.warning("Market validation failed: ticker %s not in context", ticker)
            return False
            
    return True


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
        return getattr(result, "rowcount", 0)

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
    Orchestrates the full Cortex AI chat flow.

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
        self._market_service = get_market_service()

    async def _fetch_market_data(self, question: str) -> str | None:
        """
        Fetch live market data based on the user's question.
        
        Returns formatted context string with source attribution,
        or None if data cannot be fetched.
        """
        question_lower = question.lower()
        
        try:
            # Forex queries
            if "usd to inr" in question_lower or "dollar to rupee" in question_lower:
                data = await self._market_service.get_forex_rate("USD", "INR")
                return self._format_market_data(data, "USD/INR Exchange Rate")
            
            elif "eur to inr" in question_lower or "euro to rupee" in question_lower:
                data = await self._market_service.get_forex_rate("EUR", "INR")
                return self._format_market_data(data, "EUR/INR Exchange Rate")
            
            elif "gbp to inr" in question_lower or "pound to rupee" in question_lower:
                data = await self._market_service.get_forex_rate("GBP", "INR")
                return self._format_market_data(data, "GBP/INR Exchange Rate")
            
            # Crypto queries
            elif "bitcoin" in question_lower or "btc" in question_lower:
                data = await self._market_service.get_crypto_price("bitcoin", "inr")
                return self._format_market_data(data, "Bitcoin Price")
            
            elif "ethereum" in question_lower or "eth" in question_lower:
                data = await self._market_service.get_crypto_price("ethereum", "inr")
                return self._format_market_data(data, "Ethereum Price")
            
            # Commodity queries
            elif "gold" in question_lower and "price" in question_lower:
                data = await self._market_service.get_commodity_price("GOLD")
                return self._format_market_data(data, "Gold Price")
            
            elif "silver" in question_lower and "price" in question_lower:
                data = await self._market_service.get_commodity_price("SILVER")
                return self._format_market_data(data, "Silver Price")
            
            # Stock indices
            elif "nifty" in question_lower:
                data = await self._market_service.get_stock_price("NIFTY50")
                return self._format_market_data(data, "Nifty 50 Index")
            
            elif "sensex" in question_lower:
                data = await self._market_service.get_stock_price("SENSEX")
                return self._format_market_data(data, "BSE Sensex")
            
            return None
            
        except Exception as exc:
            logger.warning("Failed to fetch market data: %s", exc)
            return None

    def _format_market_data(self, data: dict[str, Any], title: str) -> str | None:
        """
        Format market data response with source attribution.
        
        Returns formatted string or None if data is unavailable.
        """
        if not data.get("available"):
            return None
        
        price = data.get("price")
        currency = data.get("currency")
        source = data.get("source")
        updated_at = data.get("updated_at")
        
        if price is None:
            return None
        
        # Convert to INR for Indian users if data is in USD
        display_price = price
        display_currency = currency
        
        if currency == "USD":
            # Use a rough conversion rate (could be fetched from API for accuracy)
            inr_rate = 87.0  # Approximate USD to INR rate
            display_price = price * inr_rate
            display_currency = "INR"
            original_price = f"({price:,.2f} USD)"
        else:
            original_price = ""
        
        # Format timestamp for display
        try:
            from datetime import datetime
            dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
            formatted_time = dt.strftime("%d %b %Y, %I:%M %p UTC")
        except:
            formatted_time = updated_at
        
        lines = [
            f"=== LIVE MARKET DATA ===",
            f"[{title}]",
            f"  Current Price: ₹{display_price:,.2f} {original_price}",
            f"  Source: {source}",
            f"  Last Updated: {formatted_time}",
            f"  Status: Live",
            "",
            "NOTE: This is real-time market data from external APIs. Prices may vary slightly across platforms."
        ]
        
        return "\n".join(lines)

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

        # 3. Check if this is a market data query (live prices, forex, crypto, etc.)
        if _is_market_data_query(user_message):
            market_context = await self._fetch_market_data(user_message)
            if market_context:
                financial_context = market_context
            else:
                financial_context = "=== MARKET DATA ===\nLive market data is temporarily unavailable. Please try again later."
        # 4. Check if this is a general knowledge question (not finance-related)
        elif _is_general_knowledge_question(user_message):
            financial_context = "=== SCOPE LIMITATION ===\nThis appears to be a general knowledge question. As a personal finance assistant, I focus on your financial data, transactions, budgeting, investments, and market information. I can't answer general knowledge questions about people, places, history, or other non-financial topics."
        else:
            # 5. Build financial context for this specific question
            financial_context = await build_financial_context(
                self._db, self._user_id, user_message, self._ai, history_dicts
            )

        # 6. Build the message list for the chat call
        system_prompt = finance_assistant_system_prompt()
        messages: list[ChatMessageSchema] = []

        # History (user + assistant alternating, no system messages)
        for h in history:
            if h.role in ("user", "assistant"):
                messages.append(ChatMessageSchema(role=h.role, content=h.content))

        # Append the new user question
        messages.append(ChatMessageSchema(role="user", content=user_message))

        # 7. Call AIService.chat() — system prompt goes as the `context` arg
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
            
        # Post-validation for market data
        if not _validate_market_response(chat_response.response, financial_context):
            chat_response.response = "I couldn't generate a reliable market-data response for that request. Please try again."

        # 8. Persist user + assistant messages
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
