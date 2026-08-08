import asyncio
from sqlalchemy import select, func
from app.database import AsyncSessionLocal
from app.models.transaction import Transaction

async def main():
    async with AsyncSessionLocal() as db:
        query = select(
            Transaction.user_id,
            func.min(Transaction.transaction_date).label('min_date'),
            func.max(Transaction.transaction_date).label('max_date'),
            func.count(Transaction.id).label('count')
        ).group_by(Transaction.user_id)
        
        result = await db.execute(query)
        rows = result.all()
        for row in rows:
            print(f"User: {row.user_id}, Min Date: {row.min_date}, Max Date: {row.max_date}, Count: {row.count}")

if __name__ == "__main__":
    asyncio.run(main())
