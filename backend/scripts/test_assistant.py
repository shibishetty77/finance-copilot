import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.modules.ai.assistant_service import AssistantService
from app.modules.ai.providers import get_provider
from app.models.user import User

async def run_test(svc, question, f):
    f.write(f"\n--- Q: {question} ---\n")
    res = await svc.chat(question)
    f.write(f"A: {res['response']}\n")

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User))
        user = result.scalars().first()
        if not user:
            print("No users found.")
            return
        
        provider = get_provider()
        svc = AssistantService(provider, db, str(user.id), "test-conv-3")
        
        with open("scripts/test_output.txt", "w", encoding="utf-8") as f:
            await run_test(svc, "How much did I spend this month?", f)
            await run_test(svc, "What about last month?", f)
            await run_test(svc, "What is my net worth?", f)

if __name__ == "__main__":
    asyncio.run(main())
