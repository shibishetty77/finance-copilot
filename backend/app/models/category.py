"""
SQLAlchemy ORM model for the categories table.
Seeded with default expense categories on first run.
"""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    color: Mapped[str | None] = mapped_column(String(7), nullable=True)   # hex e.g. #FF6B6B
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # NULL = system-defined category; String(36) UUID = user-defined category
    user_id: Mapped[str | None] = mapped_column(
        String(36),                               # Compatible with both SQLite & PostgreSQL
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<Category id={self.id} name={self.name}>"


# ── Default category seed data ────────────────────────────────────────────────
DEFAULT_CATEGORIES: list[dict] = [
    {"name": "Food",           "icon": "food",           "color": "#FF6B6B"},
    {"name": "Groceries",      "icon": "groceries",      "color": "#4ECDC4"},
    {"name": "Transport",      "icon": "transport",      "color": "#45B7D1"},
    {"name": "Rent",           "icon": "rent",           "color": "#96CEB4"},
    {"name": "Utilities",      "icon": "utilities",      "color": "#FFEAA7"},
    {"name": "Shopping",       "icon": "shopping",       "color": "#DDA0DD"},
    {"name": "Entertainment",  "icon": "entertainment",  "color": "#98D8C8"},
    {"name": "Healthcare",     "icon": "healthcare",     "color": "#F7DC6F"},
    {"name": "Education",      "icon": "education",      "color": "#85C1E9"},
    {"name": "Investments",    "icon": "investments",    "color": "#82E0AA"},
    {"name": "Subscriptions",  "icon": "subscriptions",  "color": "#F0B27A"},
    {"name": "Miscellaneous",  "icon": "miscellaneous",  "color": "#AEB6BF"},
    {"name": "Income",         "icon": "income",         "color": "#2ECC71"},
    {"name": "Salary",         "icon": "salary",         "color": "#27AE60"},
    {"name": "Freelance",      "icon": "freelance",      "color": "#1ABC9C"},
    {"name": "Business",       "icon": "business",       "color": "#3498DB"},
    {"name": "Other Income",   "icon": "other_income",   "color": "#9B59B6"},
]
