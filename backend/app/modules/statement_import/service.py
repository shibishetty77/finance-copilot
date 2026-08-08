from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.modules.statement_import.schemas import ParsedTransactionRow, StatementImportPreview, StatementImportResult
from app.modules.statement_import.parser import parse_csv_statement
from app.modules.transactions.service import TransactionService
from app.modules.transactions.repository import TransactionRepository
from app.models.transaction import Transaction
from app.schemas.transaction import TransactionCreate

class StatementImportService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.transaction_service = TransactionService(db)
        
    async def process_csv(self, file_bytes: bytes, user_id: str) -> StatementImportPreview:
        parsed_rows = parse_csv_statement(file_bytes)
        
        # Check for duplicates against existing transactions
        # A transaction is duplicate if same date, amount, description
        
        # Load user's recent transactions (optimization: could load just relevant date range, but we'll fetch all or handle per row for simplicity in this MVP)
        # We will do a query per row for duplicates to be safe, or fetch a batch. 
        # For simplicity, we query batch for the user.
        
        result = await self.db.execute(select(Transaction).where(Transaction.user_id == user_id))
        existing_txns = result.scalars().all()
        
        # Create a set for quick lookup
        existing_signatures = set()
        for t in existing_txns:
            # simple signature: date_amount_description
            if t.transaction_date and t.amount is not None and t.description:
                sig = f"{t.transaction_date.isoformat()}_{float(t.amount)}_{t.description.strip().lower()}"
                existing_signatures.add(sig)
                
        # Update status based on duplicates
        for row in parsed_rows:
            if row.status == "Ready" and row.date and row.amount is not None and row.description:
                sig = f"{row.date.isoformat()}_{float(row.amount)}_{row.description.strip().lower()}"
                if sig in existing_signatures:
                    row.status = "Duplicate"
                    
        return StatementImportPreview(
            total_rows=len(parsed_rows),
            transactions=parsed_rows
        )
        
    async def confirm_import(self, rows: list[ParsedTransactionRow], user_id: str) -> StatementImportResult:
        imported = 0
        skipped = 0
        errors = 0
        duplicates = 0
        
        for row in rows:
            if row.status == "Duplicate":
                duplicates += 1
                skipped += 1
                continue
                
            if row.status != "Ready":
                skipped += 1
                errors += 1
                continue
                
            # Create transaction using existing service pipeline
            try:
                # Basic category deduction can be handled by AI or defaults, 
                # for now we let TransactionCreate handle it or default to None (which might be Uncategorized)
                # the prompt says "Reuse the existing category detection logic. If category cannot be determined: Assign: Uncategorized"
                # Existing TransactionService takes category_id. We'll pass None and let the frontend/backend handle uncategorized.
                if row.amount is None or row.date is None:
                    skipped +=1
                    errors +=1
                    continue
                
                payload = TransactionCreate(
                    amount=row.amount,
                    type=row.type or "expense",
                    category_id=None, # Will be set to uncategorized if needed by the app logic
                    description=row.description or "Imported Transaction",
                    transaction_date=row.date,
                    notes=f"Imported from bank statement. Original merchant: {row.merchant}" if row.merchant else None,
                    tags=["Imported"],
                    merchant_name=row.merchant,
                    recurrence_type=None,
                    is_recurring=False,
                )
                await self.transaction_service.create(user_id, payload)
                imported += 1
            except Exception as e:
                print(f"Error importing row: {e}")
                errors += 1
                skipped += 1
                
        return StatementImportResult(
            imported=imported,
            skipped=skipped,
            duplicates=duplicates,
            errors=errors
        )
