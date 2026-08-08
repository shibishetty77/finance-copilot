import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.modules.ai.assistant_context_tools import build_financial_context
from app.models.user import User

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        user = result.scalars().first()
        if not user:
            print("No users found.")
            return
        
        print(f"User: {user.email} ID: {user.id}")
        context = await build_financial_context(db, str(user.id), "How much did I spend this month?")
        with open("scripts/context_output.txt", "w", encoding="utf-8") as f:
            f.write(context)

if __name__ == "__main__":
    asyncio.run(main())
