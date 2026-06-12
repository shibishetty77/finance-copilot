"""
SQLAlchemy ORM model for the portfolio_snapshots table.
Stores historical portfolio values for timeline and analytics.
"""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


def _utcnow() -> datetime:
    """Return current UTC time — used as Python-side column default."""
    return datetime.now(timezone.utc)


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

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
    portfolio_value: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    invested_amount: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    gain_loss: Mapped[float] = mapped_column(
        Numeric(15, 2), nullable=False
    )
    # Future-ready: milestone tracking
    milestone_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # first_investment, crossed_10k, crossed_50k, etc.
    milestone_value: Mapped[float | None] = mapped_column(
        Numeric(15, 2), nullable=True
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

    # ── Relationships ────────────────────────────────────────────────────────────
    user: Mapped["User"] = relationship(back_populates="portfolio_snapshots")

    def __repr__(self) -> str:
        return f"<PortfolioSnapshot id={self.id} portfolio_value={self.portfolio_value}>"
