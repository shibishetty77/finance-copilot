"""
Seed script — populates the categories table with default values.
Run once after migrations: python scripts/seed_categories.py
"""

import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.category import Category, DEFAULT_CATEGORIES


async def seed_categories() -> None:
    async with AsyncSessionLocal() as session:
        async with session.begin():
            # Check if already seeded
            result = await session.execute(
                select(Category).where(Category.user_id.is_(None)).limit(1)
            )
            if result.scalar_one_or_none():
                print("Categories already seeded -- skipping.")
                return

            categories = [
                Category(
                    name=cat["name"],
                    icon=cat["icon"],
                    color=cat["color"],
                    is_custom=False,
                    user_id=None,
                )
                for cat in DEFAULT_CATEGORIES
            ]
            session.add_all(categories)

        print(f"Seeded {len(DEFAULT_CATEGORIES)} default categories.")


if __name__ == "__main__":
    asyncio.run(seed_categories())
