"""
Transaction service — business logic for transaction CRUD operations.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.transactions.repository import TransactionRepository
from app.schemas.transaction import (
    TransactionCreate,
    TransactionMonthlySummary,
    TransactionPaginationResponse,
    TransactionResponse,
    TransactionUpdate,
)


class TransactionService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = TransactionRepository(db)

    async def create(self, user_id: str, payload: TransactionCreate) -> TransactionResponse:
        """Create a new transaction."""
        transaction = await self.repo.create(
            user_id=user_id,
            amount=payload.amount,
            type=payload.type,
            category_id=payload.category_id,
            description=payload.description,
            transaction_date=payload.transaction_date,
            notes=payload.notes,
            tags=payload.tags,
            is_recurring=payload.is_recurring,
            recurrence_type=payload.recurrence_type,
            merchant_name=payload.merchant_name,
            transaction_source="manual",
        )
        return TransactionResponse.model_validate(transaction)

    async def get_by_id(self, transaction_id: uuid.UUID, user_id: str) -> TransactionResponse:
        """Get a transaction by ID."""
        transaction = await self.repo.get_by_id(transaction_id, user_id)
        if not transaction:
            raise NotFoundError("Transaction")
        return TransactionResponse.model_validate(transaction)

    async def list_all(
        self,
        user_id: str,
        category_id: int | None = None,
        type: str | None = None,
        date_from: str | None = None,
        date_to: str | None = None,
        amount_min: float | None = None,
        amount_max: float | None = None,
        search_query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> TransactionPaginationResponse:
        """List transactions with filtering, search, and pagination."""
        from datetime import datetime

        # Parse date strings if provided
        parsed_date_from = None
        parsed_date_to = None
        if date_from:
            parsed_date_from = datetime.strptime(date_from, "%Y-%m-%d").date()
        if date_to:
            parsed_date_to = datetime.strptime(date_to, "%Y-%m-%d").date()

        transactions, total = await self.repo.list_all(
            user_id=user_id,
            category_id=category_id,
            type=type,
            date_from=parsed_date_from,
            date_to=parsed_date_to,
            amount_min=amount_min,
            amount_max=amount_max,
            search_query=search_query,
            page=page,
            page_size=page_size,
        )

        total_pages = (total + page_size - 1) // page_size if total > 0 else 0

        return TransactionPaginationResponse(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
            items=[TransactionResponse.model_validate(t) for t in transactions],
        )

    async def update(
        self, transaction_id: uuid.UUID, user_id: str, payload: TransactionUpdate
    ) -> TransactionResponse:
        """Update a transaction."""
        # Check if transaction exists
        existing = await self.repo.get_by_id(transaction_id, user_id)
        if not existing:
            raise NotFoundError("Transaction")

        # Build update values dict
        values: dict = {}
        if payload.description is not None:
            values["description"] = payload.description
        if payload.amount is not None:
            values["amount"] = payload.amount
        if payload.type is not None:
            values["type"] = payload.type
        if payload.category_id is not None:
            values["category_id"] = payload.category_id
        if payload.transaction_date is not None:
            values["transaction_date"] = payload.transaction_date
        if payload.notes is not None:
            values["notes"] = payload.notes
        if payload.tags is not None:
            values["tags"] = payload.tags
        if payload.is_recurring is not None:
            values["is_recurring"] = payload.is_recurring
        if payload.recurrence_type is not None:
            values["recurrence_type"] = payload.recurrence_type
        if payload.merchant_name is not None:
            values["merchant_name"] = payload.merchant_name

        if not values:
            return TransactionResponse.model_validate(existing)

        updated = await self.repo.update(transaction_id, user_id, values)
        return TransactionResponse.model_validate(updated)

    async def delete(self, transaction_id: uuid.UUID, user_id: str) -> None:
        """Delete a transaction."""
        existing = await self.repo.get_by_id(transaction_id, user_id)
        if not existing:
            raise NotFoundError("Transaction")
        await self.repo.delete(transaction_id, user_id)

    async def get_monthly_summary(self, user_id: str) -> list[TransactionMonthlySummary]:
        """Get monthly income, expenses, and savings summary."""
        summaries = await self.repo.get_monthly_summary(user_id)
        return [TransactionMonthlySummary(**s) for s in summaries]
