"""
Import all models so Alembic autogenerate can discover them.
"""

from app.models.ai_settings import AISettings
from app.models.category import Category
from app.models.chat_message import ChatMessage
from app.models.goal import Goal
from app.models.holding import Holding
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.transaction import Transaction
from app.models.user import User
from app.models.watchlist import Watchlist
from app.models.gmail_credential import GmailCredential

__all__ = ["User", "Category", "Transaction", "Holding", "Watchlist", "PortfolioSnapshot", "Goal", "AISettings", "GmailCredential", "ChatMessage"]
