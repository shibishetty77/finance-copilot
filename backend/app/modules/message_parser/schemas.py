from pydantic import BaseModel, Field
from datetime import date

class ParseMessageRequest(BaseModel):
    message: str = Field(..., description="The raw message text to parse")

class ParsedMessageResponse(BaseModel):
    description: str | None = Field(None, description="A clean description of the transaction")
    merchant_name: str | None = Field(None, description="The merchant or entity involved")
    amount: float | None = Field(None, description="The transaction amount")
    transaction_type: str | None = Field(None, description="Either 'income' or 'expense'")
    transaction_date: date | None = Field(None, description="The date of the transaction in YYYY-MM-DD format")
    category: str | None = Field(None, description="The most likely category")
    payment_method: str | None = Field(None, description="The payment method used, e.g., UPI, Card")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score between 0.0 and 1.0")
