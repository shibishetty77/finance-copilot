"""
Transaction repository — all database queries for the transactions table.
Follows the repository pattern: no business logic here.
"""

import json
import uuid
from datetime import date
from typing import Any

from sqlalchemy import and_, case, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction


class TransactionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, transaction_id: uuid.UUID, user_id: str) -> Transaction | None:
        result = await self.db.execute(
            select(Transaction).where(
                and_(Transaction.id == str(transaction_id), Transaction.user_id == user_id)
            )
        )
        return result.scalar_one_or_none()

    async def create(
        self,
        user_id: str,
        amount: float,
        type: str,
        category_id: int | None,
        description: str | None,
        transaction_date: date,
        notes: str | None,
        tags: list[str] | None,
        is_recurring: bool,
        recurrence_type: str | None,
        merchant_name: str | None,
        transaction_source: str = "manual",
    ) -> Transaction:
        transaction = Transaction(
            user_id=user_id,
            amount=amount,
            type=type,
            category_id=category_id,
            description=description,
            transaction_date=transaction_date,
            notes=notes,
            tags=json.dumps(tags) if tags else None,
            is_recurring=is_recurring,
            recurrence_type=recurrence_type,
            merchant_name=merchant_name,
            transaction_source=transaction_source,
        )
        self.db.add(transaction)
        await self.db.flush()
        await self.db.refresh(transaction)
        return transaction

    async def list_all(
        self,
        user_id: str,
        category_id: int | None = None,
        type: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        amount_min: float | None = None,
        amount_max: float | None = None,
        search_query: str | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Transaction], int]:
        """List transactions with filtering, search, and pagination."""
        # Build base query
        query = select(Transaction).where(Transaction.user_id == user_id)
        count_query = select(func.count()).where(Transaction.user_id == user_id)

        # Apply filters
        conditions = []

        if category_id is not None:
            conditions.append(Transaction.category_id == category_id)

        if type is not None:
            conditions.append(Transaction.type == type)

        if date_from is not None:
            conditions.append(Transaction.transaction_date >= date_from)

        if date_to is not None:
            conditions.append(Transaction.transaction_date <= date_to)

        if amount_min is not None:
            conditions.append(Transaction.amount >= amount_min)

        if amount_max is not None:
            conditions.append(Transaction.amount <= amount_max)

        if search_query:
            search_pattern = f"%{search_query}%"
            conditions.append(
                or_(
                    Transaction.description.ilike(search_pattern),
                    Transaction.merchant_name.ilike(search_pattern),
                    Transaction.tags.ilike(search_pattern),
                )
            )

        if conditions:
            query = query.where(and_(*conditions))
            count_query = count_query.where(and_(*conditions))

        # Get total count
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        # Apply pagination and ordering
        query = query.order_by(Transaction.transaction_date.desc(), Transaction.created_at.desc())
        query = query.offset((page - 1) * page_size).limit(page_size)

        result = await self.db.execute(query)
        transactions = result.scalars().all()

        return list(transactions), total

    async def update(
        self,
        transaction_id: uuid.UUID,
        user_id: str,
        values: dict[str, Any],
    ) -> Transaction | None:
        """Update transaction with given values."""
        # Convert tags to JSON string if present
        if "tags" in values and values["tags"] is not None:
            values["tags"] = json.dumps(values["tags"])

        await self.db.execute(
            update(Transaction)
            .where(and_(Transaction.id == str(transaction_id), Transaction.user_id == user_id))
            .values(**values)
        )
        return await self.get_by_id(transaction_id, user_id)

    async def delete(self, transaction_id: uuid.UUID, user_id: str) -> None:
        """Delete transaction."""
        from sqlalchemy import delete as delete_stmt
        await self.db.execute(
            delete_stmt(Transaction).where(
                and_(Transaction.id == str(transaction_id), Transaction.user_id == user_id)
            )
        )

    async def get_monthly_summary(self, user_id: str) -> list[dict[str, Any]]:
        """Get monthly income, expenses, and savings summary."""
        # Use strftime for SQLite date formatting (works with both SQLite and PostgreSQL)
        query = (
            select(
                func.strftime("%Y-%m", Transaction.transaction_date).label("month"),
                func.sum(
                    case(
                        (Transaction.type == "income", Transaction.amount),
                        else_=0,
                    )
                ).label("income"),
                func.sum(
                    case(
                        (Transaction.type == "expense", Transaction.amount),
                        else_=0,
                    )
                ).label("expenses"),
            )
            .where(Transaction.user_id == user_id)
            .group_by(func.strftime("%Y-%m", Transaction.transaction_date))
            .order_by(func.strftime("%Y-%m", Transaction.transaction_date).desc())
        )

        result = await self.db.execute(query)
        rows = result.all()

        summaries = []
        for row in rows:
            income = float(row.income or 0)
            expenses = float(row.expenses or 0)
            summaries.append(
                {
                    "month": row.month,
                    "income": income,
                    "expenses": expenses,
                    "savings": income - expenses,
                }
            )

        return summaries
