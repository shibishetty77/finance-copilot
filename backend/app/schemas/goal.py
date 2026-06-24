"""
Pydantic schemas for goal endpoints.
"""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class GoalBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    target_amount: float = Field(..., gt=0)
    current_amount: float = Field(0, ge=0)
    target_date: date | None = None
    description: str | None = None


class GoalCreate(GoalBase):
    pass


class GoalUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    target_amount: float | None = Field(None, gt=0)
    current_amount: float | None = Field(None, ge=0)
    target_date: date | None = None
    description: str | None = None


class GoalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: str
    name: str
    target_amount: float
    current_amount: float
    target_date: date | None
    description: str | None
    created_at: datetime
    updated_at: datetime
