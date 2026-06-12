"""
User repository — all database queries for the users table.
Follows the repository pattern: no business logic here.
"""

import uuid

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == str(user_id)))
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> User | None:
        result = await self.db.execute(
            select(User).where(User.email == email.lower().strip())
        )
        return result.scalar_one_or_none()

    async def email_exists(self, email: str) -> bool:
        result = await self.db.execute(
            select(User.id).where(User.email == email.lower().strip())
        )
        return result.scalar_one_or_none() is not None

    async def create(
        self,
        email: str,
        full_name: str,
        hashed_password: str,
        phone: str | None = None,
    ) -> User:
        user = User(
            email=email.lower().strip(),
            full_name=full_name.strip(),
            hashed_password=hashed_password,
            phone=phone,
        )
        self.db.add(user)
        await self.db.flush()   # Get generated ID without committing
        await self.db.refresh(user)
        return user

    async def update_profile(
        self,
        user_id: uuid.UUID,
        full_name: str | None = None,
        phone: str | None = None,
    ) -> User | None:
        values: dict = {}
        if full_name is not None:
            values["full_name"] = full_name.strip()
        if phone is not None:
            values["phone"] = phone

        if not values:
            return await self.get_by_id(user_id)

        await self.db.execute(
            update(User).where(User.id == str(user_id)).values(**values)
        )
        return await self.get_by_id(user_id)

    async def update_password(self, user_id: uuid.UUID, hashed_password: str) -> None:
        await self.db.execute(
            update(User)
            .where(User.id == str(user_id))
            .values(hashed_password=hashed_password)
        )

    async def deactivate(self, user_id: uuid.UUID) -> None:
        await self.db.execute(
            update(User).where(User.id == str(user_id)).values(is_active=False)
        )
