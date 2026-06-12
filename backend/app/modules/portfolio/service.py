"""
Portfolio service — business logic for holdings, watchlist, and portfolio metrics.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.portfolio.repository import PortfolioRepository
from app.schemas.holding import (
    AssetAllocation,
    DiversificationScore,
    HoldingCreate,
    HoldingPaginationResponse,
    HoldingResponse,
    HoldingUpdate,
    Milestone,
    MilestonesResponse,
    PerformanceAnalytics,
    PortfolioAllocation,
    PortfolioSummary,
    RiskScore,
    SectorAllocation,
    TopPerformer,
    WorstPerformer,
)
from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistPaginationResponse,
    WatchlistResponse,
    WatchlistUpdate,
)


class PortfolioService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = PortfolioRepository(db)

    # ── Holdings CRUD ─────────────────────────────────────────────────────────────

    async def create_holding(self, user_id: str, payload: HoldingCreate) -> HoldingResponse:
        """Create a new holding."""
        holding = await self.repo.create_holding(
            user_id=user_id,
            symbol=payload.symbol,
            company_name=payload.company_name,
            asset_type=payload.asset_type,
            sector=payload.sector,
            quantity=payload.quantity,
            average_buy_price=payload.average_buy_price,
            current_price=payload.current_price,
            purchase_date=payload.purchase_date,
            notes=payload.notes,
            tags=payload.tags,
        )

        # Deserialize tags from JSON string to list for response validation
        if holding.tags and isinstance(holding.tags, str):
            try:
                holding.tags = json.loads(holding.tags)
            except json.JSONDecodeError:
                holding.tags = None

        # Create portfolio snapshot
        summary = await self.repo.get_portfolio_summary(user_id)
        await self.repo.create_portfolio_snapshot(
            user_id=user_id,
            portfolio_value=summary["total_portfolio_value"],
            invested_amount=summary["total_invested_amount"],
            gain_loss=summary["total_gain_loss"],
        )

        return HoldingResponse.model_validate(holding)

    async def get_holding_by_id(self, holding_id: uuid.UUID, user_id: str) -> HoldingResponse:
        """Get a holding by ID."""
        holding = await self.repo.get_holding_by_id(holding_id, user_id)
        if not holding:
            raise NotFoundError("Holding")
        
        # Deserialize tags from JSON string to list for response validation
        if holding.tags and isinstance(holding.tags, str):
            try:
                holding.tags = json.loads(holding.tags)
            except json.JSONDecodeError:
                holding.tags = None
        
        return HoldingResponse.model_validate(holding)

    async def list_holdings(
        self,
        user_id: str,
        asset_type: str | None = None,
        sector: str | None = None,
        search_query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> HoldingPaginationResponse:
        """List holdings with filtering, search, and pagination."""
        holdings, total = await self.repo.list_holdings(
            user_id=user_id,
            asset_type=asset_type,
            sector=sector,
            search_query=search_query,
            page=page,
            page_size=page_size,
        )

        total_pages = (total + page_size - 1) // page_size if total > 0 else 0

        # Deserialize tags from JSON string to list for each holding
        for holding in holdings:
            if holding.tags and isinstance(holding.tags, str):
                try:
                    holding.tags = json.loads(holding.tags)
                except json.JSONDecodeError:
                    holding.tags = None

        return HoldingPaginationResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=[HoldingResponse.model_validate(h) for h in holdings],
        )

    async def update_holding(
        self, holding_id: uuid.UUID, user_id: str, payload: HoldingUpdate
    ) -> HoldingResponse:
        """Update a holding."""
        print(f"[UPDATE HOLDING] SERVICE: Method called")
        print(f"[UPDATE HOLDING] SERVICE: holding_id={holding_id}")
        print(f"[UPDATE HOLDING] SERVICE: user_id={user_id}")
        print(f"[UPDATE HOLDING] SERVICE: payload={payload}")
        print(f"[UPDATE HOLDING] SERVICE: payload type={type(payload)}")
        
        # Check if holding exists
        existing = await self.repo.get_holding_by_id(holding_id, user_id)
        if not existing:
            print(f"[UPDATE HOLDING] SERVICE: Holding not found")
            raise NotFoundError("Holding")

        print(f"[UPDATE HOLDING] SERVICE: Existing holding found: id={existing.id}, symbol={existing.symbol}")

        # Build update values dict
        values: dict = {}
        if payload.symbol is not None:
            values["symbol"] = payload.symbol
        if payload.company_name is not None:
            values["company_name"] = payload.company_name
        if payload.asset_type is not None:
            values["asset_type"] = payload.asset_type
        if payload.sector is not None:
            values["sector"] = payload.sector
        if payload.quantity is not None:
            values["quantity"] = payload.quantity
        if payload.average_buy_price is not None:
            values["average_buy_price"] = payload.average_buy_price
        if payload.current_price is not None:
            values["current_price"] = payload.current_price
        if payload.purchase_date is not None:
            values["purchase_date"] = payload.purchase_date
        if payload.notes is not None:
            values["notes"] = payload.notes
        if payload.tags is not None:
            values["tags"] = payload.tags

        print(f"[UPDATE HOLDING] SERVICE: Update values dict: {values}")
        print(f"[UPDATE HOLDING] SERVICE: Number of fields to update: {len(values)}")

        if not values:
            print(f"[UPDATE HOLDING] SERVICE: No values to update, returning existing")
            # Deserialize tags from JSON string to list for response validation
            if existing.tags and isinstance(existing.tags, str):
                try:
                    existing.tags = json.loads(existing.tags)
                except json.JSONDecodeError:
                    existing.tags = None
            return HoldingResponse.model_validate(existing)

        print(f"[UPDATE HOLDING] SERVICE: Calling repository.update_holding")
        updated = await self.repo.update_holding(holding_id, user_id, values)
        print(f"[UPDATE HOLDING] SERVICE: Repository returned updated holding: id={updated.id}, symbol={updated.symbol}")

        # Deserialize tags from JSON string to list for response validation
        print(f"[UPDATE HOLDING] SERVICE: Before deserialization - tags={updated.tags}, type={type(updated.tags)}")
        if updated.tags and isinstance(updated.tags, str):
            try:
                updated.tags = json.loads(updated.tags)
                print(f"[UPDATE HOLDING] SERVICE: After deserialization - tags={updated.tags}, type={type(updated.tags)}")
            except json.JSONDecodeError as e:
                print(f"[UPDATE HOLDING] SERVICE: JSON decode error: {e}")
                updated.tags = None

        # Create portfolio snapshot after update
        print(f"[UPDATE HOLDING] SERVICE: Creating portfolio snapshot")
        summary = await self.repo.get_portfolio_summary(user_id)
        await self.repo.create_portfolio_snapshot(
            user_id=user_id,
            portfolio_value=summary["total_portfolio_value"],
            invested_amount=summary["total_invested_amount"],
            gain_loss=summary["total_gain_loss"],
        )
        print(f"[UPDATE HOLDING] SERVICE: Portfolio snapshot created")

        print(f"[UPDATE HOLDING] SERVICE: Calling HoldingResponse.model_validate")
        response = HoldingResponse.model_validate(updated)
        print(f"[UPDATE HOLDING] SERVICE: Validation successful, returning response")
        return response

    async def delete_holding(self, holding_id: uuid.UUID, user_id: str) -> None:
        """Delete a holding."""
        existing = await self.repo.get_holding_by_id(holding_id, user_id)
        if not existing:
            raise NotFoundError("Holding")
        await self.repo.delete_holding(holding_id, user_id)

        # Create portfolio snapshot after delete
        summary = await self.repo.get_portfolio_summary(user_id)
        await self.repo.create_portfolio_snapshot(
            user_id=user_id,
            portfolio_value=summary["total_portfolio_value"],
            invested_amount=summary["total_invested_amount"],
            gain_loss=summary["total_gain_loss"],
        )

    # ── Portfolio Metrics ───────────────────────────────────────────────────────────

    async def get_portfolio_summary(self, user_id: str) -> PortfolioSummary:
        """Get portfolio summary metrics."""
        summary = await self.repo.get_portfolio_summary(user_id)
        return PortfolioSummary(**summary)

    async def get_portfolio_allocation(self, user_id: str) -> PortfolioAllocation:
        """Get portfolio allocation (asset and sector)."""
        asset_allocation_data = await self.repo.get_asset_allocation(user_id)
        sector_allocation_data = await self.repo.get_sector_allocation(user_id)

        asset_allocation = [AssetAllocation(**a) for a in asset_allocation_data]
        sector_allocation = [SectorAllocation(**s) for s in sector_allocation_data]

        return PortfolioAllocation(
            asset_allocation=asset_allocation,
            sector_allocation=sector_allocation,
        )

    async def get_diversification_score(self, user_id: str) -> DiversificationScore:
        """Calculate diversification score (0-100)."""
        summary = await self.repo.get_portfolio_summary(user_id)
        asset_allocation = await self.repo.get_asset_allocation(user_id)
        sector_allocation = await self.repo.get_sector_allocation(user_id)

        factors: dict[str, float] = {}
        recommendations: list[str] = []

        # Factor 1: Number of holdings (more = better, max 25 points)
        holdings_count = summary["holdings_count"]
        holdings_score = min(holdings_count * 5, 25)
        factors["holdings_count"] = holdings_score
        if holdings_count < 5:
            recommendations.append("Consider adding more holdings to improve diversification")

        # Factor 2: Asset concentration (balanced = better, max 25 points)
        asset_types = len(asset_allocation)
        asset_score = min(asset_types * 8.33, 25)  # 3 asset types = 25 points
        factors["asset_concentration"] = asset_score
        if asset_types < 3:
            recommendations.append("Consider adding exposure to different asset types (ETFs, bonds, etc.)")

        # Factor 3: Sector concentration (less concentration = better, max 25 points)
        sector_types = len(sector_allocation)
        sector_score = min(sector_types * 6.25, 25)  # 4 sectors = 25 points
        factors["sector_concentration"] = sector_score
        if sector_types < 4:
            recommendations.append("Consider diversifying across more sectors")

        # Factor 4: Single holding exposure (no single holding > 30% = better, max 25 points)
        if summary["total_portfolio_value"] > 0:
            holdings, _ = await self.repo.list_holdings(user_id, page=1, page_size=100)
            if holdings:
                max_holding_value = max(h.current_value for h in holdings)
                max_holding_pct = (max_holding_value / summary["total_portfolio_value"]) * 100
                exposure_score = max(25 - (max_holding_pct - 30) * 0.5, 0) if max_holding_pct > 30 else 25
                factors["single_holding_exposure"] = exposure_score
                if max_holding_pct > 30:
                    recommendations.append(f"High single-stock risk detected: {max_holding_pct:.1f}% in one holding")
            else:
                factors["single_holding_exposure"] = 0
        else:
            factors["single_holding_exposure"] = 0

        total_score = int(sum(factors.values()))

        return DiversificationScore(
            score=total_score,
            factors=factors,
            recommendations=recommendations,
        )

    async def get_risk_score(self, user_id: str) -> RiskScore:
        """Calculate risk score (0-100, higher = riskier)."""
        summary = await self.repo.get_portfolio_summary(user_id)
        asset_allocation = await self.repo.get_asset_allocation(user_id)
        sector_allocation = await self.repo.get_sector_allocation(user_id)

        factors: dict[str, float] = {}
        recommendations: list[str] = []

        # Factor 1: Asset class risk (crypto = high risk, max 40 points)
        asset_risk_map = {"crypto": 40, "stock": 20, "etf": 10, "mutual_fund": 15, "bond": 5}
        asset_risk_score = 0
        for asset in asset_allocation:
            risk = asset_risk_map.get(asset["asset_type"], 15)
            weight = asset["percentage"] / 100
            asset_risk_score += risk * weight
        factors["asset_class_risk"] = asset_risk_score
        if asset_risk_score > 25:
            recommendations.append("Portfolio has high asset class risk - consider safer investments")

        # Factor 2: Sector risk (volatile sectors = higher risk, max 30 points)
        volatile_sectors = ["technology", "crypto", "biotech"]
        sector_risk_score = 0
        for sector in sector_allocation:
            if sector["sector"].lower() in volatile_sectors:
                sector_risk_score += 15 * (sector["percentage"] / 100)
        factors["sector_risk"] = min(sector_risk_score, 30)
        if sector_risk_score > 15:
            recommendations.append("High exposure to volatile sectors detected")

        # Factor 3: Concentration risk (max 30 points)
        if summary["total_portfolio_value"] > 0:
            holdings, _ = await self.repo.list_holdings(user_id, page=1, page_size=100)
            if holdings:
                max_holding_value = max(h.current_value for h in holdings)
                max_holding_pct = (max_holding_value / summary["total_portfolio_value"]) * 100
                concentration_score = max_holding_pct * 0.3
                factors["concentration_risk"] = concentration_score
                if max_holding_pct > 40:
                    recommendations.append("Portfolio too concentrated in single holding")
            else:
                factors["concentration_risk"] = 0
        else:
            factors["concentration_risk"] = 0

        total_score = int(min(sum(factors.values()), 100))

        return RiskScore(
            score=total_score,
            factors=factors,
            recommendations=recommendations,
        )

    async def get_performance_analytics(self, user_id: str) -> PerformanceAnalytics:
        """Get performance analytics."""
        analytics = await self.repo.get_performance_analytics(user_id)

        top_performer = None
        if analytics["top_performer"]:
            top_performer = TopPerformer(
                id=analytics["top_performer"].id,
                symbol=analytics["top_performer"].symbol,
                company_name=analytics["top_performer"].company_name,
                gain_loss_percent=analytics["top_performer"].gain_loss_percent,
                gain_loss=analytics["top_performer"].gain_loss,
            )

        worst_performer = None
        if analytics["worst_performer"]:
            worst_performer = WorstPerformer(
                id=analytics["worst_performer"].id,
                symbol=analytics["worst_performer"].symbol,
                company_name=analytics["worst_performer"].company_name,
                gain_loss_percent=analytics["worst_performer"].gain_loss_percent,
                gain_loss=analytics["worst_performer"].gain_loss,
            )

        biggest_holding = None
        if analytics["biggest_holding"]:
            biggest_holding = {
                "id": analytics["biggest_holding"].id,
                "symbol": analytics["biggest_holding"].symbol,
                "company_name": analytics["biggest_holding"].company_name,
                "current_value": analytics["biggest_holding"].current_value,
                "percentage": 0,  # Will be calculated in service
            }

        return PerformanceAnalytics(
            top_performer=top_performer,
            worst_performer=worst_performer,
            best_sector=analytics["best_sector"],
            worst_sector=analytics["worst_sector"],
            biggest_holding=biggest_holding,
        )

    async def get_milestones(self, user_id: str) -> MilestonesResponse:
        """Get investment milestones."""
        snapshots = await self.repo.get_portfolio_snapshots(user_id, limit=1000)

        # Find first investment
        first_investment = None
        if snapshots:
            first_snapshot = min(snapshots, key=lambda s: s.created_at)
            first_investment = Milestone(
                type="first_investment",
                value=first_snapshot.portfolio_value,
                achieved_at=first_snapshot.created_at,
            )

        # Find milestone crossings
        thresholds = [10000, 50000, 100000, 500000]
        crossed_milestones = {}

        for snapshot in snapshots:
            for threshold in thresholds:
                if snapshot.portfolio_value >= threshold:
                    if threshold not in crossed_milestones:
                        crossed_milestones[threshold] = Milestone(
                            type=f"crossed_{threshold}",
                            value=snapshot.portfolio_value,
                            achieved_at=snapshot.created_at,
                        )

        # Find largest gain/loss
        largest_gain = None
        largest_loss = None

        for i in range(1, len(snapshots)):
            prev = snapshots[i - 1]
            curr = snapshots[i]
            gain = curr.gain_loss - prev.gain_loss

            if gain > 0:
                if largest_gain is None or gain > largest_gain.value:
                    largest_gain = Milestone(
                        type="largest_gain",
                        value=gain,
                        achieved_at=curr.created_at,
                    )
            else:
                if largest_loss is None or gain < largest_loss.value:
                    largest_loss = Milestone(
                        type="largest_loss",
                        value=gain,
                        achieved_at=curr.created_at,
                    )

        return MilestonesResponse(
            first_investment=first_investment,
            crossed_10k=crossed_milestones.get(10000),
            crossed_50k=crossed_milestones.get(50000),
            crossed_100k=crossed_milestones.get(100000),
            crossed_500k=crossed_milestones.get(500000),
            largest_gain=largest_gain,
            largest_loss=largest_loss,
        )

    # ── Watchlist CRUD ─────────────────────────────────────────────────────────────

    async def create_watchlist_item(self, user_id: str, payload: WatchlistCreate) -> WatchlistResponse:
        """Create a new watchlist item."""
        watchlist = await self.repo.create_watchlist(
            user_id=user_id,
            symbol=payload.symbol,
            company_name=payload.company_name,
            sector=payload.sector,
            notes=payload.notes,
        )
        return WatchlistResponse.model_validate(watchlist)

    async def get_watchlist_by_id(self, watchlist_id: uuid.UUID, user_id: str) -> WatchlistResponse:
        """Get a watchlist item by ID."""
        watchlist = await self.repo.get_watchlist_by_id(watchlist_id, user_id)
        if not watchlist:
            raise NotFoundError("Watchlist item")
        return WatchlistResponse.model_validate(watchlist)

    async def list_watchlist(
        self,
        user_id: str,
        search_query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> WatchlistPaginationResponse:
        """List watchlist items with search and pagination."""
        items, total = await self.repo.list_watchlist(
            user_id=user_id,
            search_query=search_query,
            page=page,
            page_size=page_size,
        )

        total_pages = (total + page_size - 1) // page_size if total > 0 else 0

        return WatchlistPaginationResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=[WatchlistResponse.model_validate(w) for w in items],
        )

    async def update_watchlist(
        self, watchlist_id: uuid.UUID, user_id: str, payload: WatchlistUpdate
    ) -> WatchlistResponse:
        """Update a watchlist item."""
        existing = await self.repo.get_watchlist_by_id(watchlist_id, user_id)
        if not existing:
            raise NotFoundError("Watchlist item")

        values: dict = {}
        if payload.symbol is not None:
            values["symbol"] = payload.symbol
        if payload.company_name is not None:
            values["company_name"] = payload.company_name
        if payload.sector is not None:
            values["sector"] = payload.sector
        if payload.notes is not None:
            values["notes"] = payload.notes

        if not values:
            return WatchlistResponse.model_validate(existing)

        updated = await self.repo.update_watchlist(watchlist_id, user_id, values)
        return WatchlistResponse.model_validate(updated)

    async def delete_watchlist(self, watchlist_id: uuid.UUID, user_id: str) -> None:
        """Delete a watchlist item."""
        existing = await self.repo.get_watchlist_by_id(watchlist_id, user_id)
        if not existing:
            raise NotFoundError("Watchlist item")
        await self.repo.delete_watchlist(watchlist_id, user_id)
