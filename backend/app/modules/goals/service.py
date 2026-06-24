"""
Goal service — business logic for goal CRUD operations.
"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.modules.goals.repository import GoalRepository
from app.schemas.goal import GoalCreate, GoalResponse, GoalUpdate


class GoalService:
    def __init__(self, db: AsyncSession) -> None:
        self.repo = GoalRepository(db)

    async def create(self, user_id: str, payload: GoalCreate) -> GoalResponse:
        if payload.current_amount > payload.target_amount:
            raise ValidationError("Current amount cannot exceed target amount")

        goal = await self.repo.create(
            user_id=user_id,
            name=payload.name,
            target_amount=payload.target_amount,
            current_amount=payload.current_amount,
            target_date=payload.target_date,
            description=payload.description,
        )
        return GoalResponse.model_validate(goal)

    async def get_by_id(self, goal_id: uuid.UUID, user_id: str) -> GoalResponse:
        goal = await self.repo.get_by_id(goal_id, user_id)
        if not goal:
            raise NotFoundError("Goal")
        return GoalResponse.model_validate(goal)

    async def list_all(self, user_id: str) -> list[GoalResponse]:
        goals = await self.repo.list_all(user_id)
        return [GoalResponse.model_validate(g) for g in goals]

    async def update(
        self, goal_id: uuid.UUID, user_id: str, payload: GoalUpdate
    ) -> GoalResponse:
        existing = await self.repo.get_by_id(goal_id, user_id)
        if not existing:
            raise NotFoundError("Goal")

        values: dict = {}
        if payload.name is not None:
            values["name"] = payload.name
        if payload.target_amount is not None:
            values["target_amount"] = payload.target_amount
        if payload.current_amount is not None:
            values["current_amount"] = payload.current_amount
        if payload.target_date is not None:
            values["target_date"] = payload.target_date
        if payload.description is not None:
            values["description"] = payload.description

        if not values:
            return GoalResponse.model_validate(existing)

        target = values.get("target_amount", existing.target_amount)
        current = values.get("current_amount", existing.current_amount)
        if float(current) > float(target):
            raise ValidationError("Current amount cannot exceed target amount")

        updated = await self.repo.update(goal_id, user_id, values)
        return GoalResponse.model_validate(updated)

    async def delete(self, goal_id: uuid.UUID, user_id: str) -> None:
        existing = await self.repo.get_by_id(goal_id, user_id)
        if not existing:
            raise NotFoundError("Goal")
        await self.repo.delete(goal_id, user_id)
