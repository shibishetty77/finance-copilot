"""
SQLAlchemy ORM model for the transactions table.
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, TypeDecorator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

import json

class JSONListString(TypeDecorator[str]):
    impl = String
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        return value

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is not None:
            try:
                return json.loads(value)
            except Exception:
                return [value]
        return None


if TYPE_CHECKING:
    from app.models.category import Category
    from app.models.user import User


def _utcnow() -> datetime:
    """Return current UTC time — used as Python-side column default."""
    return datetime.now(timezone.utc)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        String(36),  # Store UUID as TEXT — works for both SQLite & Postgres
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
    )
    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    type: Mapped[str] = mapped_column(
        String(10), nullable=False
    )  # 'income' or 'expense'
    category_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    transaction_date: Mapped[datetime] = mapped_column(
        Date, nullable=False, index=True
    )
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(JSONListString, nullable=True)  # JSON stored as string, deserialized as list
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recurrence_type: Mapped[str | None] = mapped_column(String(20), nullable=True)  # monthly, weekly, yearly
    merchant_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    transaction_source: Mapped[str] = mapped_column(
        String(20), nullable=False, default="manual"
    )  # manual, csv_import, bank_import, upi_import, ai_generated, gmail
    gmail_message_id: Mapped[str | None] = mapped_column(
        String(100), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=_utcnow,
        onupdate=_utcnow,
        nullable=False,
    )

    # ── Relationships ────────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="transactions")
    category: Mapped["Category"] = relationship()

    def __repr__(self) -> str:
        return f"<Transaction id={self.id} amount={self.amount} type={self.type}>"
