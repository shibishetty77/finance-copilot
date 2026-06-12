"""
Portfolio repository — all database queries for holdings, watchlist, and portfolio metrics.
Follows the repository pattern: no business logic here.
"""

import json
import uuid
from datetime import date
from typing import Any

from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.holding import Holding
from app.models.portfolio_snapshot import PortfolioSnapshot
from app.models.watchlist import Watchlist


class PortfolioRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ── Holdings CRUD ─────────────────────────────────────────────────────────────

    async def get_holding_by_id(self, holding_id: uuid.UUID, user_id: str) -> Holding | None:
        """Get a holding by ID for a specific user."""
        result = await self.db.execute(
            select(Holding).where(
                and_(Holding.id == str(holding_id), Holding.user_id == user_id)
            )
        )
        return result.scalar_one_or_none()

    async def create_holding(
        self,
        user_id: str,
        symbol: str,
        company_name: str | None,
        asset_type: str,
        sector: str | None,
        quantity: float,
        average_buy_price: float,
        current_price: float,
        purchase_date: date,
        notes: str | None,
        tags: list[str] | None,
    ) -> Holding:
        """Create a new holding."""
        # Calculate derived fields
        invested_amount = quantity * average_buy_price
        current_value = quantity * current_price
        gain_loss = current_value - invested_amount
        gain_loss_percent = (gain_loss / invested_amount * 100) if invested_amount > 0 else 0

        holding = Holding(
            user_id=user_id,
            symbol=symbol,
            company_name=company_name,
            asset_type=asset_type,
            sector=sector,
            quantity=quantity,
            average_buy_price=average_buy_price,
            current_price=current_price,
            invested_amount=invested_amount,
            current_value=current_value,
            gain_loss=gain_loss,
            gain_loss_percent=gain_loss_percent,
            purchase_date=purchase_date,
            notes=notes,
            tags=json.dumps(tags) if tags else None,
        )
        self.db.add(holding)
        await self.db.flush()
        return holding

    async def list_holdings(
        self,
        user_id: str,
        asset_type: str | None = None,
        sector: str | None = None,
        search_query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Holding], int]:
        """List holdings with filtering, search, and pagination."""
        query = select(Holding).where(Holding.user_id == user_id)

        # Apply filters
        if asset_type:
            query = query.where(Holding.asset_type == asset_type)
        if sector:
            query = query.where(Holding.sector == sector)
        if search_query:
            search_pattern = f"%{search_query}%"
            query = query.where(
                or_(
                    Holding.symbol.ilike(search_pattern),
                    Holding.company_name.ilike(search_pattern),
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        query = query.order_by(Holding.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        holdings = result.scalars().all()

        return list(holdings), total

    async def update_holding(
        self, holding_id: uuid.UUID, user_id: str, values: dict[str, Any]
    ) -> Holding:
        """Update a holding."""
        print(f"[UPDATE HOLDING] REPOSITORY: Method called")
        print(f"[UPDATE HOLDING] REPOSITORY: holding_id={holding_id}")
        print(f"[UPDATE HOLDING] REPOSITORY: user_id={user_id}")
        print(f"[UPDATE HOLDING] REPOSITORY: values={values}")
        print(f"[UPDATE HOLDING] REPOSITORY: values type={type(values)}")
        
        # Recalculate derived fields if price or quantity changed
        if "quantity" in values or "current_price" in values or "average_buy_price" in values:
            print(f"[UPDATE HOLDING] REPOSITORY: Recalculating derived fields")
            holding = await self.get_holding_by_id(holding_id, user_id)
            if not holding:
                print(f"[UPDATE HOLDING] REPOSITORY: Holding not found")
                raise ValueError("Holding not found")

            quantity = float(values.get("quantity", holding.quantity))
            average_buy_price = float(values.get("average_buy_price", holding.average_buy_price))
            current_price = float(values.get("current_price", holding.current_price))

            values["invested_amount"] = quantity * average_buy_price
            values["current_value"] = quantity * current_price
            values["gain_loss"] = values["current_value"] - values["invested_amount"]
            values["gain_loss_percent"] = (
                (values["gain_loss"] / values["invested_amount"] * 100)
                if values["invested_amount"] > 0
                else 0
            )
            print(f"[UPDATE HOLDING] REPOSITORY: Recalculated derived fields: {values}")

        # Convert tags to JSON if provided
        if "tags" in values and values["tags"] is not None:
            print(f"[UPDATE HOLDING] REPOSITORY: Converting tags to JSON: {values['tags']}")
            values["tags"] = json.dumps(values["tags"])
            print(f"[UPDATE HOLDING] REPOSITORY: Tags converted to: {values['tags']}")

        print(f"[UPDATE HOLDING] REPOSITORY: Executing UPDATE statement")
        print(f"[UPDATE HOLDING] REPOSITORY: Before database update")
        await self.db.execute(
            update(Holding)
            .where(and_(Holding.id == str(holding_id), Holding.user_id == user_id))
            .values(values)
        )
        print(f"[UPDATE HOLDING] REPOSITORY: UPDATE statement executed")
        await self.db.flush()
        print(f"[UPDATE HOLDING] REPOSITORY: Flush completed (database commit)")

        print(f"[UPDATE HOLDING] REPOSITORY: Fetching updated holding from database")
        updated = await self.get_holding_by_id(holding_id, user_id)
        print(f"[UPDATE HOLDING] REPOSITORY: Fetched updated holding: id={updated.id}, symbol={updated.symbol}")
        print(f"[UPDATE HOLDING] REPOSITORY: Returning updated holding")
        return updated

    async def delete_holding(self, holding_id: uuid.UUID, user_id: str) -> None:
        """Delete a holding."""
        from sqlalchemy import delete as delete_stmt
        await self.db.execute(
            delete_stmt(Holding).where(
                and_(Holding.id == str(holding_id), Holding.user_id == user_id)
            )
        )

    # ── Portfolio Metrics ───────────────────────────────────────────────────────────

    async def get_portfolio_summary(self, user_id: str) -> dict[str, Any]:
        """Get portfolio summary metrics."""
        result = await self.db.execute(
            select(
                func.sum(Holding.current_value).label("total_portfolio_value"),
                func.sum(Holding.invested_amount).label("total_invested_amount"),
                func.count(Holding.id).label("holdings_count"),
            ).where(Holding.user_id == user_id)
        )
        row = result.one()

        total_portfolio_value = float(row.total_portfolio_value or 0)
        total_invested_amount = float(row.total_invested_amount or 0)
        total_gain_loss = total_portfolio_value - total_invested_amount
        total_gain_loss_percent = (
            (total_gain_loss / total_invested_amount * 100) if total_invested_amount > 0 else 0
        )

        return {
            "total_portfolio_value": total_portfolio_value,
            "total_invested_amount": total_invested_amount,
            "total_gain_loss": total_gain_loss,
            "total_gain_loss_percent": total_gain_loss_percent,
            "holdings_count": row.holdings_count or 0,
        }

    async def get_asset_allocation(self, user_id: str) -> list[dict[str, Any]]:
        """Get asset allocation breakdown."""
        result = await self.db.execute(
            select(
                Holding.asset_type,
                func.sum(Holding.current_value).label("total_value"),
            )
            .where(Holding.user_id == user_id)
            .group_by(Holding.asset_type)
        )

        total_result = await self.db.execute(
            select(func.sum(Holding.current_value)).where(Holding.user_id == user_id)
        )
        total_value = total_result.scalar() or 0

        allocation = []
        for row in result.all():
            percentage = (row.total_value / total_value * 100) if total_value > 0 else 0
            allocation.append(
                {
                    "asset_type": row.asset_type,
                    "value": float(row.total_value),
                    "percentage": percentage,
                }
            )

        return allocation

    async def get_sector_allocation(self, user_id: str) -> list[dict[str, Any]]:
        """Get sector allocation breakdown."""
        result = await self.db.execute(
            select(
                Holding.sector,
                func.sum(Holding.current_value).label("total_value"),
            )
            .where(Holding.user_id == user_id)
            .where(Holding.sector.isnot(None))
            .group_by(Holding.sector)
        )

        total_result = await self.db.execute(
            select(func.sum(Holding.current_value)).where(Holding.user_id == user_id)
        )
        total_value = total_result.scalar() or 0

        allocation = []
        for row in result.all():
            percentage = (row.total_value / total_value * 100) if total_value > 0 else 0
            allocation.append(
                {
                    "sector": row.sector,
                    "value": float(row.total_value),
                    "percentage": percentage,
                }
            )

        return allocation

    async def get_performance_analytics(self, user_id: str) -> dict[str, Any]:
        """Get performance analytics (top/worst performers)."""
        # Top performer
        top_result = await self.db.execute(
            select(Holding)
            .where(Holding.user_id == user_id)
            .order_by(Holding.gain_loss_percent.desc())
            .limit(1)
        )
        top_performer = top_result.scalar_one_or_none()

        # Worst performer
        worst_result = await self.db.execute(
            select(Holding)
            .where(Holding.user_id == user_id)
            .order_by(Holding.gain_loss_percent.asc())
            .limit(1)
        )
        worst_performer = worst_result.scalar_one_or_none()

        # Best sector
        sector_result = await self.db.execute(
            select(
                Holding.sector,
                func.avg(Holding.gain_loss_percent).label("avg_gain"),
            )
            .where(Holding.user_id == user_id)
            .where(Holding.sector.isnot(None))
            .group_by(Holding.sector)
            .order_by(func.avg(Holding.gain_loss_percent).desc())
            .limit(1)
        )
        best_sector_row = sector_result.scalar_one_or_none()
        best_sector = best_sector_row[0] if best_sector_row else None

        # Biggest holding
        biggest_result = await self.db.execute(
            select(Holding)
            .where(Holding.user_id == user_id)
            .order_by(Holding.current_value.desc())
            .limit(1)
        )
        biggest_holding = biggest_result.scalar_one_or_none()

        return {
            "top_performer": top_performer,
            "worst_performer": worst_performer,
            "best_sector": best_sector,
            "worst_sector": None,  # Can be calculated similarly
            "biggest_holding": biggest_holding,
        }

    # ── Watchlist CRUD ─────────────────────────────────────────────────────────────

    async def get_watchlist_by_id(self, watchlist_id: uuid.UUID, user_id: str) -> Watchlist | None:
        """Get a watchlist item by ID for a specific user."""
        result = await self.db.execute(
            select(Watchlist).where(
                and_(Watchlist.id == str(watchlist_id), Watchlist.user_id == user_id)
            )
        )
        return result.scalar_one_or_none()

    async def create_watchlist(
        self,
        user_id: str,
        symbol: str,
        company_name: str | None,
        sector: str | None,
        notes: str | None,
    ) -> Watchlist:
        """Create a new watchlist item."""
        watchlist = Watchlist(
            user_id=user_id,
            symbol=symbol,
            company_name=company_name,
            sector=sector,
            notes=notes,
        )
        self.db.add(watchlist)
        await self.db.flush()
        return watchlist

    async def list_watchlist(
        self,
        user_id: str,
        search_query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Watchlist], int]:
        """List watchlist items with search and pagination."""
        query = select(Watchlist).where(Watchlist.user_id == user_id)

        if search_query:
            search_pattern = f"%{search_query}%"
            query = query.where(
                or_(
                    Watchlist.symbol.ilike(search_pattern),
                    Watchlist.company_name.ilike(search_pattern),
                )
            )

        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination
        query = query.order_by(Watchlist.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        items = result.scalars().all()

        return list(items), total

    async def update_watchlist(
        self, watchlist_id: uuid.UUID, user_id: str, values: dict[str, Any]
    ) -> Watchlist:
        """Update a watchlist item."""
        await self.db.execute(
            update(Watchlist)
            .where(and_(Watchlist.id == str(watchlist_id), Watchlist.user_id == user_id))
            .values(values)
        )
        await self.db.flush()

        updated = await self.get_watchlist_by_id(watchlist_id, user_id)
        return updated

    async def delete_watchlist(self, watchlist_id: uuid.UUID, user_id: str) -> None:
        """Delete a watchlist item."""
        from sqlalchemy import delete as delete_stmt
        await self.db.execute(
            delete_stmt(Watchlist).where(
                and_(Watchlist.id == str(watchlist_id), Watchlist.user_id == user_id)
            )
        )

    # ── Portfolio Snapshots ─────────────────────────────────────────────────────────

    async def create_portfolio_snapshot(
        self,
        user_id: str,
        portfolio_value: float,
        invested_amount: float,
        gain_loss: float,
        milestone_type: str | None = None,
        milestone_value: float | None = None,
    ) -> PortfolioSnapshot:
        """Create a portfolio snapshot."""
        snapshot = PortfolioSnapshot(
            user_id=user_id,
            portfolio_value=portfolio_value,
            invested_amount=invested_amount,
            gain_loss=gain_loss,
            milestone_type=milestone_type,
            milestone_value=milestone_value,
        )
        self.db.add(snapshot)
        await self.db.flush()
        return snapshot

    async def get_portfolio_snapshots(
        self, user_id: str, limit: int = 100
    ) -> list[PortfolioSnapshot]:
        """Get portfolio snapshots for a user."""
        result = await self.db.execute(
            select(PortfolioSnapshot)
            .where(PortfolioSnapshot.user_id == user_id)
            .order_by(PortfolioSnapshot.created_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())
