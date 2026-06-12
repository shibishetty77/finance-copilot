"""
Portfolio router — HTTP endpoints for holdings, watchlist, and portfolio metrics.
All endpoints follow the API specification exactly.
"""

import uuid

from fastapi import APIRouter, Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.exceptions import UnauthorizedError
from app.core.security import verify_access_token
from app.database import AsyncSession, get_db
from app.modules.portfolio.service import PortfolioService
from app.schemas.holding import (
    DiversificationScore,
    HoldingCreate,
    HoldingPaginationResponse,
    HoldingResponse,
    HoldingUpdate,
    MilestonesResponse,
    PerformanceAnalytics,
    PortfolioAllocation,
    PortfolioSummary,
    RiskScore,
)
from app.schemas.watchlist import (
    WatchlistCreate,
    WatchlistPaginationResponse,
    WatchlistResponse,
    WatchlistUpdate,
)

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])
bearer_scheme = HTTPBearer(auto_error=False)


# ── Helper: get current user ID ─────────────────────────────────────────────────
async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """Extract and validate the Bearer token, return user ID string."""
    if not credentials:
        raise UnauthorizedError("Authorization header missing")
    try:
        user_id = verify_access_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Invalid or expired access token")
    return user_id


# ── Holdings CRUD ───────────────────────────────────────────────────────────────

@router.post(
    "/holdings",
    response_model=HoldingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new holding",
)
async def create_holding(
    payload: HoldingCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> HoldingResponse:
    svc = PortfolioService(db)
    return await svc.create_holding(user_id, payload)


@router.get(
    "/holdings",
    response_model=HoldingPaginationResponse,
    summary="List holdings with filtering and pagination",
)
async def list_holdings(
    asset_type: str | None = Query(None, description="Filter by asset type"),
    sector: str | None = Query(None, description="Filter by sector"),
    search: str | None = Query(None, description="Search in symbol, company name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> HoldingPaginationResponse:
    svc = PortfolioService(db)
    return await svc.list_holdings(
        user_id=user_id,
        asset_type=asset_type,
        sector=sector,
        search_query=search,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/holdings/{holding_id}",
    response_model=HoldingResponse,
    summary="Get a holding by ID",
)
async def get_holding(
    holding_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> HoldingResponse:
    svc = PortfolioService(db)
    return await svc.get_holding_by_id(holding_id, user_id)


@router.put(
    "/holdings/{holding_id}",
    response_model=HoldingResponse,
    summary="Update a holding",
)
async def update_holding(
    holding_id: uuid.UUID,
    payload: HoldingUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> HoldingResponse:
    print(f"[UPDATE HOLDING] ROUTER: Endpoint called")
    print(f"[UPDATE HOLDING] ROUTER: holding_id={holding_id}")
    print(f"[UPDATE HOLDING] ROUTER: user_id={user_id}")
    print(f"[UPDATE HOLDING] ROUTER: payload={payload}")
    print(f"[UPDATE HOLDING] ROUTER: payload type={type(payload)}")
    try:
        svc = PortfolioService(db)
        result = await svc.update_holding(holding_id, user_id, payload)
        print(f"[UPDATE HOLDING] ROUTER: Service returned successfully")
        print(f"[UPDATE HOLDING] ROUTER: Returning result")
        return result
    except Exception as e:
        print(f"[UPDATE HOLDING] ROUTER: Exception occurred: {type(e).__name__}: {e}")
        import traceback
        print(f"[UPDATE HOLDING] ROUTER: Traceback:\n{traceback.format_exc()}")
        raise


@router.delete(
    "/holdings/{holding_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a holding",
)
async def delete_holding(
    holding_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    svc = PortfolioService(db)
    await svc.delete_holding(holding_id, user_id)


# ── Portfolio Metrics ─────────────────────────────────────────────────────────────

@router.get(
    "/summary",
    response_model=PortfolioSummary,
    summary="Get portfolio summary metrics",
)
async def get_portfolio_summary(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PortfolioSummary:
    svc = PortfolioService(db)
    return await svc.get_portfolio_summary(user_id)


@router.get(
    "/allocation",
    response_model=PortfolioAllocation,
    summary="Get portfolio allocation (asset and sector)",
)
async def get_portfolio_allocation(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PortfolioAllocation:
    svc = PortfolioService(db)
    return await svc.get_portfolio_allocation(user_id)


@router.get(
    "/diversification",
    response_model=DiversificationScore,
    summary="Get diversification score analysis",
)
async def get_diversification_score(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DiversificationScore:
    svc = PortfolioService(db)
    return await svc.get_diversification_score(user_id)


@router.get(
    "/risk",
    response_model=RiskScore,
    summary="Get risk score analysis",
)
async def get_risk_score(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> RiskScore:
    svc = PortfolioService(db)
    return await svc.get_risk_score(user_id)


@router.get(
    "/performance",
    response_model=PerformanceAnalytics,
    summary="Get performance analytics",
)
async def get_performance_analytics(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> PerformanceAnalytics:
    svc = PortfolioService(db)
    return await svc.get_performance_analytics(user_id)


@router.get(
    "/milestones",
    response_model=MilestonesResponse,
    summary="Get investment milestones",
)
async def get_milestones(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> MilestonesResponse:
    svc = PortfolioService(db)
    return await svc.get_milestones(user_id)


# ── Watchlist CRUD ───────────────────────────────────────────────────────────────

@router.post(
    "/watchlist",
    response_model=WatchlistResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add item to watchlist",
)
async def create_watchlist_item(
    payload: WatchlistCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WatchlistResponse:
    svc = PortfolioService(db)
    return await svc.create_watchlist_item(user_id, payload)


@router.get(
    "/watchlist",
    response_model=WatchlistPaginationResponse,
    summary="List watchlist items",
)
async def list_watchlist(
    search: str | None = Query(None, description="Search in symbol, company name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WatchlistPaginationResponse:
    svc = PortfolioService(db)
    return await svc.list_watchlist(
        user_id=user_id,
        search_query=search,
        page=page,
        page_size=page_size,
    )


@router.get(
    "/watchlist/{watchlist_id}",
    response_model=WatchlistResponse,
    summary="Get watchlist item by ID",
)
async def get_watchlist_item(
    watchlist_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WatchlistResponse:
    svc = PortfolioService(db)
    return await svc.get_watchlist_by_id(watchlist_id, user_id)


@router.put(
    "/watchlist/{watchlist_id}",
    response_model=WatchlistResponse,
    summary="Update watchlist item",
)
async def update_watchlist_item(
    watchlist_id: uuid.UUID,
    payload: WatchlistUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> WatchlistResponse:
    svc = PortfolioService(db)
    return await svc.update_watchlist(watchlist_id, user_id, payload)


@router.delete(
    "/watchlist/{watchlist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete watchlist item",
)
async def delete_watchlist_item(
    watchlist_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    svc = PortfolioService(db)
    await svc.delete_watchlist(watchlist_id, user_id)
