"""
Goal repository — database queries for the goals table.
"""

import uuid
from typing import Any

from sqlalchemy import and_, delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.goal import Goal


class GoalRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, goal_id: uuid.UUID, user_id: str) -> Goal | None:
        result = await self.db.execute(
            select(Goal).where(
                and_(Goal.id == str(goal_id), Goal.user_id == user_id)
            )
        )
        return result.scalar_one_or_none()

    async def list_all(self, user_id: str) -> list[Goal]:
        result = await self.db.execute(
            select(Goal)
            .where(Goal.user_id == user_id)
            .order_by(Goal.created_at.desc())
        )
        return list(result.scalars().all())

    async def create(
        self,
        user_id: str,
        name: str,
        target_amount: float,
        current_amount: float,
        target_date: Any,
        description: str | None,
    ) -> Goal:
        goal = Goal(
            user_id=user_id,
            name=name,
            target_amount=target_amount,
            current_amount=current_amount,
            target_date=target_date,
            description=description,
        )
        self.db.add(goal)
        await self.db.flush()
        await self.db.refresh(goal)
        return goal

    async def update(
        self,
        goal_id: uuid.UUID,
        user_id: str,
        values: dict[str, Any],
    ) -> Goal | None:
        await self.db.execute(
            update(Goal)
            .where(and_(Goal.id == str(goal_id), Goal.user_id == user_id))
            .values(**values)
        )
        return await self.get_by_id(goal_id, user_id)

    async def delete(self, goal_id: uuid.UUID, user_id: str) -> None:
        await self.db.execute(
            delete(Goal).where(
                and_(Goal.id == str(goal_id), Goal.user_id == user_id)
            )
        )
