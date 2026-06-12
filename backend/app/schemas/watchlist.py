"""
Pydantic schemas for watchlist CRUD operations.
"""

from datetime import date
from pydantic import BaseModel, ConfigDict, Field


class WatchlistBase(BaseModel):
    """Base schema for watchlist data."""
    symbol: str = Field(..., min_length=1, max_length=20, description="Stock/crypto symbol")
    company_name: str | None = Field(None, max_length=255, description="Company name")
    sector: str | None = Field(None, max_length=50, description="Sector/industry")
    notes: str | None = Field(None, description="Additional notes")


class WatchlistCreate(WatchlistBase):
    """Schema for creating a new watchlist item."""
    pass


class WatchlistUpdate(BaseModel):
    """Schema for updating a watchlist item (all fields optional)."""
    symbol: str | None = Field(None, min_length=1, max_length=20)
    company_name: str | None = Field(None, max_length=255)
    sector: str | None = Field(None, max_length=50)
    notes: str | None = None


class WatchlistResponse(BaseModel):
    """Schema for watchlist response."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    symbol: str
    company_name: str | None
    sector: str | None
    notes: str | None
    created_at: date


class WatchlistPaginationResponse(BaseModel):
    """Schema for paginated watchlist response."""
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[WatchlistResponse]
