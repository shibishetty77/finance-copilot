"""
OCR module — Pydantic request/response schemas.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Response schemas ──────────────────────────────────────────────────────────


class OCRResponse(BaseModel):
    """Raw OCR text extracted from an image."""

    text: str = Field(..., description="Raw text extracted from the uploaded image.")


class ReceiptParseResponse(BaseModel):
    """
    Structured transaction data extracted from a receipt via OCR + AI.

    Mirrors the ParsedTransaction shape on the frontend so the review screen
    can be reused without any mapping.
    """

    merchant: str | None = Field(None, description="Merchant or payee name.")
    amount: float | None = Field(None, description="Total amount paid in INR.")
    category: str | None = Field(None, description="Transaction category name.")
    type: Literal["income", "expense"] = Field(
        "expense", description="Transaction type."
    )
    description: str | None = Field(None, description="Short memo / description.")
    transaction_date: str | None = Field(
        None, description="ISO date YYYY-MM-DD."
    )
    confidence: float = Field(
        0.5,
        ge=0.0,
        le=1.0,
        description="AI confidence score between 0 and 1.",
    )


class OCRErrorResponse(BaseModel):
    """Error response when OCR cannot extract usable text."""

    code: str = Field(
        "ocr_failure",
        description="Machine-readable error code.",
    )
    message: str = Field(..., description="Human-readable explanation.")
    suggestions: list[str] = Field(
        default_factory=list,
        description="Tips for the user to improve OCR quality.",
    )
