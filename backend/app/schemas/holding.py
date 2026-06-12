"""
Pydantic schemas for holding CRUD operations and portfolio metrics.
"""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class HoldingBase(BaseModel):
    """Base schema for holding data."""
    symbol: str = Field(..., min_length=1, max_length=20, description="Stock/crypto symbol")
    company_name: str | None = Field(None, max_length=255, description="Company name")
    asset_type: str = Field(..., description="Asset type: stock, mutual_fund, etf, bond, crypto")
    sector: str | None = Field(None, max_length=50, description="Sector/industry")
    quantity: float = Field(..., gt=0, description="Number of units/shares")
    average_buy_price: float = Field(..., gt=0, description="Average buy price per unit")
    current_price: float = Field(..., gt=0, description="Current market price per unit")
    purchase_date: date = Field(..., description="Purchase date")
    notes: str | None = Field(None, description="Additional notes")
    tags: list[str] | None = Field(default=None, description="Tags for categorization")

    @field_validator("asset_type")
    @classmethod
    def validate_asset_type(cls, v: str) -> str:
        valid_types = ["stock", "mutual_fund", "etf", "bond", "crypto"]
        if v not in valid_types:
            raise ValueError(f"asset_type must be one of {valid_types}")
        return v


class HoldingCreate(HoldingBase):
    """Schema for creating a new holding."""
    pass


class HoldingUpdate(BaseModel):
    """Schema for updating a holding (all fields optional)."""
    symbol: str | None = Field(None, min_length=1, max_length=20)
    company_name: str | None = Field(None, max_length=255)
    asset_type: str | None = None
    sector: str | None = Field(None, max_length=50)
    quantity: float | None = Field(None, gt=0)
    average_buy_price: float | None = Field(None, gt=0)
    current_price: float | None = Field(None, gt=0)
    purchase_date: date | None = None
    notes: str | None = None
    tags: list[str] | None = None

    @field_validator("asset_type")
    @classmethod
    def validate_asset_type(cls, v: str | None) -> str | None:
        if v is not None:
            valid_types = ["stock", "mutual_fund", "etf", "bond", "crypto"]
            if v not in valid_types:
                raise ValueError(f"asset_type must be one of {valid_types}")
        return v


class HoldingResponse(BaseModel):
    """Schema for holding response."""
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    symbol: str
    company_name: str | None
    asset_type: str
    sector: str | None
    quantity: float
    average_buy_price: float
    current_price: float
    invested_amount: float
    current_value: float
    gain_loss: float
    gain_loss_percent: float
    purchase_date: date
    notes: str | None
    tags: list[str] | None
    dividend_amount: float | None
    dividend_date: date | None
    benchmark_id: int | None
    created_at: datetime
    updated_at: datetime

    @field_validator("tags", mode="before")
    @classmethod
    def parse_tags(cls, v: Any) -> list[str] | None:
        if isinstance(v, str):
            import json
            try:
                return json.loads(v)
            except json.JSONDecodeError:
                return None
        return v


class HoldingPaginationResponse(BaseModel):
    """Schema for paginated holdings response."""
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[HoldingResponse]


class PortfolioSummary(BaseModel):
    """Schema for portfolio summary metrics."""
    total_portfolio_value: float
    total_invested_amount: float
    total_gain_loss: float
    total_gain_loss_percent: float
    holdings_count: int


class AssetAllocation(BaseModel):
    """Schema for asset allocation breakdown."""
    asset_type: str
    value: float
    percentage: float


class SectorAllocation(BaseModel):
    """Schema for sector allocation breakdown."""
    sector: str
    value: float
    percentage: float


class PortfolioAllocation(BaseModel):
    """Schema for portfolio allocation (asset and sector)."""
    asset_allocation: list[AssetAllocation]
    sector_allocation: list[SectorAllocation]


class DiversificationScore(BaseModel):
    """Schema for diversification score analysis."""
    score: int  # 0-100
    factors: dict[str, Any]  # Individual factor scores
    recommendations: list[str]


class RiskScore(BaseModel):
    """Schema for risk score analysis."""
    score: int  # 0-100
    factors: dict[str, Any]  # Individual factor scores
    recommendations: list[str]


class TopPerformer(BaseModel):
    """Schema for top performing holding."""
    id: str
    symbol: str
    company_name: str | None
    gain_loss_percent: float
    gain_loss: float


class WorstPerformer(BaseModel):
    """Schema for worst performing holding."""
    id: str
    symbol: str
    company_name: str | None
    gain_loss_percent: float
    gain_loss: float


class PerformanceAnalytics(BaseModel):
    """Schema for performance analytics."""
    top_performer: TopPerformer | None
    worst_performer: WorstPerformer | None
    best_sector: str | None
    worst_sector: str | None
    biggest_holding: dict[str, Any] | None


class Milestone(BaseModel):
    """Schema for investment milestone."""
    type: str
    value: float
    achieved_at: date


class MilestonesResponse(BaseModel):
    """Schema for milestones response."""
    first_investment: Milestone | None
    crossed_10k: Milestone | None
    crossed_50k: Milestone | None
    crossed_100k: Milestone | None
    crossed_500k: Milestone | None
    largest_gain: Milestone | None
    largest_loss: Milestone | None
