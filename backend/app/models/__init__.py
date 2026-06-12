"""
Import all models so Alembic autogenerate can discover them.
"""

from app.models.category import Category
from app.models.holding import Holding
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.transaction import Transaction
from app.models.user import User
from app.models.watchlist import Watchlist

__all__ = ["User", "Category", "Transaction", "Holding", "Watchlist", "PortfolioSnapshot"]
