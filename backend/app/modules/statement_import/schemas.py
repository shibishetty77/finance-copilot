import datetime
from pydantic import BaseModel

class ParsedTransactionRow(BaseModel):
    date: datetime.date | None = None
    description: str | None = None
    merchant: str | None = None
    amount: float | None = None
    type: str | None = None  # "income" or "expense"
    status: str = "Ready"  # "Ready", "Duplicate", "Missing Data", "Invalid"
    original_row: dict[str, str]

class StatementImportPreview(BaseModel):
    total_rows: int
    transactions: list[ParsedTransactionRow]

class StatementImportConfirmRequest(BaseModel):
    transactions: list[ParsedTransactionRow]

class StatementImportResult(BaseModel):
    imported: int
    skipped: int
    duplicates: int
    errors: int
