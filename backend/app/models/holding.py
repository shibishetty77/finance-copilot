"""
SQLAlchemy ORM model for the holdings table.
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


def _utcnow() -> datetime:
    """Return current UTC time — used as Python-side column default."""
    return datetime.now(timezone.utc)


class Holding(Base):
    __tablename__ = "holdings"

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
    symbol: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    company_name: Mapped[str] = mapped_column(String(255), nullable=True)
    asset_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # stock, mutual_fund, etf, bond, crypto
    sector: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity: Mapped[float] = mapped_column(
        Numeric(15, 4), nullable=False
    )
    average_buy_price: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    current_price: Mapped[float] = mapped_column(
        Numeric(10, 2), nullable=False
    )
    invested_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    current_value: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    gain_loss: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    gain_loss_percent: Mapped[float] = mapped_column(
        Numeric(8, 2), nullable=False
    )
    purchase_date: Mapped[datetime] = mapped_column(
        Date, nullable=False
    )
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    tags: Mapped[str | None] = mapped_column(String, nullable=True)  # JSON stored as string
    # Future-ready: dividend tracking
    dividend_amount: Mapped[float | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    dividend_date: Mapped[datetime | None] = mapped_column(
        Date, nullable=True
    )
    # Future-ready: benchmark comparison
    benchmark_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True
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
    user: Mapped["User"] = relationship(back_populates="holdings")

    def __repr__(self) -> str:
        return f"<Holding id={self.id} symbol={self.symbol} quantity={self.quantity}>"
