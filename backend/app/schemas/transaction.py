"""
Pydantic schemas for transaction endpoints.
Covers CRUD operations, filtering, pagination, and monthly summaries.
"""

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── Base schema ───────────────────────────────────────────────────────────────────
class TransactionBase(BaseModel):
    description: str | None = Field(None, max_length=255)
    amount: float = Field(..., gt=0)
    type: str = Field(..., pattern=r"^(income|expense)$")
    category_id: int | None = None
    transaction_date: date
    notes: str | None = None
    tags: list[str] | None = None
    is_recurring: bool = False
    recurrence_type: str | None = Field(None, pattern=r"^(monthly|weekly|yearly)$")
    merchant_name: str | None = Field(None, max_length=100)

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v: Any) -> list[str] | None:
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            # Handle JSON string from database
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [v]
        return None


# ── Request schemas ─────────────────────────────────────────────────────────────
class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    description: str | None = Field(None, max_length=255)
    amount: float | None = Field(None, gt=0)
    type: str | None = Field(None, pattern=r"^(income|expense)$")
    category_id: int | None = None
    transaction_date: date | None = None
    notes: str | None = None
    tags: list[str] | None = None
    is_recurring: bool | None = None
    recurrence_type: str | None = Field(None, pattern=r"^(monthly|weekly|yearly)$")
    merchant_name: str | None = Field(None, max_length=100)

    @field_validator("tags", mode="before")
    @classmethod
    def validate_tags(cls, v: Any) -> list[str] | None:
        if v is None:
            return None
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return [v]
        return None


# ── Response schemas ────────────────────────────────────────────────────────────
class CategoryResponse(BaseModel):
    id: int
    name: str
    icon: str | None
    color: str | None


class TransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    amount: float
    type: str
    category_id: int | None
    category: CategoryResponse | None
    description: str | None
    transaction_date: date
    notes: str | None
    tags: list[str] | None
    is_recurring: bool
    recurrence_type: str | None
    merchant_name: str | None
    transaction_source: str
    created_at: datetime
    updated_at: datetime


class TransactionMonthlySummary(BaseModel):
    month: str  # Format: "2026-06"
    income: float
    expenses: float
    savings: float


class TransactionPaginationResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[TransactionResponse]
