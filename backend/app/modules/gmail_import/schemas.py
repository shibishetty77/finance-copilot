from pydantic import BaseModel, Field
from datetime import date
from typing import Any

class GmailAuthStatus(BaseModel):
    connected: bool
    email: str | None = None

class GmailScanRequest(BaseModel):
    days: int = Field(7, ge=1, le=30)

class GmailTransactionCandidate(BaseModel):
    gmail_message_id: str
    subject: str
    sender: str
    date: str
    merchant: str | None = None
    amount: float | None = None
    currency: str = "INR"
    type: str = "expense"
    payment_method: str | None = None
    category: str | None = None
    description: str | None = None
    confidence: float = 0.0
    status: str = "Ready" # Ready, Duplicate

class GmailScanResponse(BaseModel):
    total_scanned: int
    transactions: list[GmailTransactionCandidate]

class GmailImportItem(BaseModel):
    gmail_message_id: str
    merchant: str | None
    amount: float
    type: str = "expense"
    date: str
    payment_method: str | None = None
    category: str | None = None
    description: str | None = None

class GmailImportRequest(BaseModel):
    transactions: list[GmailImportItem]

class GmailImportResponse(BaseModel):
    imported: int
    skipped: int
    duplicates: int
    errors: int
