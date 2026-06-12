"""
Transaction router — HTTP endpoints for transaction CRUD operations.
All endpoints follow the API specification exactly.
"""

import uuid

from fastapi import APIRouter, Depends, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.exceptions import UnauthorizedError
from app.core.security import verify_access_token
from app.database import AsyncSession, get_db
from app.modules.transactions.service import TransactionService
from app.schemas.transaction import (
    TransactionCreate,
    TransactionMonthlySummary,
    TransactionPaginationResponse,
    TransactionResponse,
    TransactionUpdate,
)

router = APIRouter(prefix="/transactions", tags=["Transactions"])
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


# ── Create transaction ──────────────────────────────────────────────────────────
@router.post(
    "",
    response_model=TransactionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new transaction",
)
async def create_transaction(
    payload: TransactionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    svc = TransactionService(db)
    return await svc.create(user_id, payload)


# ── List transactions ───────────────────────────────────────────────────────────
@router.get(
    "",
    response_model=TransactionPaginationResponse,
    summary="List transactions with filtering and pagination",
)
async def list_transactions(
    category_id: int | None = Query(None, description="Filter by category ID"),
    type: str | None = Query(None, pattern=r"^(income|expense)$", description="Filter by type"),
    date_from: str | None = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str | None = Query(None, description="Filter to date (YYYY-MM-DD)"),
    amount_min: float | None = Query(None, ge=0, description="Minimum amount"),
    amount_max: float | None = Query(None, ge=0, description="Maximum amount"),
    search: str | None = Query(None, description="Search in description, merchant, tags"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionPaginationResponse:
    svc = TransactionService(db)
    return await svc.list_all(
        user_id=user_id,
        category_id=category_id,
        type=type,
        date_from=date_from,
        date_to=date_to,
        amount_min=amount_min,
        amount_max=amount_max,
        search_query=search,
        page=page,
        page_size=page_size,
    )


# ── Get transaction by ID ────────────────────────────────────────────────────────
@router.get(
    "/{transaction_id}",
    response_model=TransactionResponse,
    summary="Get a transaction by ID",
)
async def get_transaction(
    transaction_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    svc = TransactionService(db)
    return await svc.get_by_id(transaction_id, user_id)


# ── Update transaction ──────────────────────────────────────────────────────────
@router.put(
    "/{transaction_id}",
    response_model=TransactionResponse,
    summary="Update a transaction",
)
async def update_transaction(
    transaction_id: uuid.UUID,
    payload: TransactionUpdate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    svc = TransactionService(db)
    return await svc.update(transaction_id, user_id, payload)


# ── Delete transaction ──────────────────────────────────────────────────────────
@router.delete(
    "/{transaction_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a transaction",
)
async def delete_transaction(
    transaction_id: uuid.UUID,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    svc = TransactionService(db)
    await svc.delete(transaction_id, user_id)


# ── Monthly summary ─────────────────────────────────────────────────────────────
@router.get(
    "/summary/monthly",
    response_model=list[TransactionMonthlySummary],
    summary="Get monthly income, expenses, and savings summary",
)
async def get_monthly_summary(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[TransactionMonthlySummary]:
    svc = TransactionService(db)
    return await svc.get_monthly_summary(user_id)
