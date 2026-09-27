"""
OCR module — HTTP router.

Registers the /api/v1/ocr/* endpoints.

Endpoints:
  POST /api/v1/ocr/receipt        — Auth required. Returns raw OCR text.
  POST /api/v1/ocr/receipt/parse  — Auth required. Returns structured transaction.

Architecture rule: The router is intentionally thin.
  - OCR work is delegated to OCRService.
  - AI structuring is delegated to AIService (via the existing AI module).
  - Neither service knows about the other.

Security:
  - MIME type is validated before any processing.
  - File size is capped at MAX_IMAGE_SIZE_BYTES.
  - Images are processed entirely in memory — never persisted to disk.
"""

import logging
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from app.core.exceptions import UnauthorizedError
from app.core.security import verify_access_token
from app.modules.ai.prompt_templates import receipt_prompt
from app.modules.ai.providers import AIProvider, get_provider
from app.modules.ai.service import AIService
from app.modules.ocr.schemas import OCRResponse, ReceiptParseResponse
from app.modules.ocr.service import OCRService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR"])
bearer_scheme = HTTPBearer(auto_error=False)

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

ALLOWED_MIME_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
}

OCR_FAILURE_SUGGESTIONS = [
    "Take a clearer photo with good lighting",
    "Avoid blurry or out-of-focus images",
    "Ensure the receipt text is fully visible and not cropped",
    "Try a PNG or high-quality JPEG for best results",
]


# ── Auth dependency ───────────────────────────────────────────────────────────


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """Extract and validate the Bearer token, return the user ID string."""
    if not credentials:
        raise UnauthorizedError("Authorization header missing")
    try:
        user_id = verify_access_token(credentials.credentials)
    except JWTError:
        raise UnauthorizedError("Invalid or expired access token")
    return user_id


# ── Shared helpers ────────────────────────────────────────────────────────────


async def _read_and_validate_image(file: UploadFile) -> bytes:
    """
    Read the uploaded file and validate MIME type + size.

    Args:
        file: The uploaded UploadFile from FastAPI.

    Returns:
        Raw image bytes.

    Raises:
        HTTPException 400: Invalid MIME type or file too large.
    """
    # Validate content type
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "invalid_file_type",
                "message": (
                    f"Unsupported file type: '{content_type}'. "
                    "Accepted formats: PNG, JPEG, WEBP."
                ),
            },
        )

    # Read into memory
    image_bytes = await file.read()

    # Validate size
    if len(image_bytes) > MAX_IMAGE_SIZE_BYTES:
        size_mb = len(image_bytes) / (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "code": "file_too_large",
                "message": (
                    f"File size {size_mb:.1f} MB exceeds the 10 MB limit. "
                    "Please compress or crop the image."
                ),
            },
        )

    return image_bytes


def _map_ai_response_to_parse_response(data: dict[str, Any]) -> ReceiptParseResponse:
    """
    Map the raw AI JSON dict to a ReceiptParseResponse.

    The receipt_prompt() returns a superset of fields (items, gst, etc.).
    We pick only the fields the frontend needs.
    """
    raw_type = str(data.get("transaction_type") or data.get("type") or "expense").lower()
    tx_type = "income" if raw_type == "income" else "expense"

    raw_amount = data.get("total_amount") or data.get("amount")
    amount: float | None = None
    try:
        if raw_amount is not None:
            amount = float(raw_amount)
            if amount <= 0:
                amount = None
    except (TypeError, ValueError):
        amount = None

    raw_confidence = data.get("confidence")
    confidence = 0.5
    try:
        if raw_confidence is not None:
            confidence = max(0.0, min(1.0, float(raw_confidence)))
    except (TypeError, ValueError):
        pass

    return ReceiptParseResponse(
        merchant=data.get("merchant_name") or data.get("merchant") or None,
        amount=amount,
        category=data.get("category") or None,
        type=tx_type,  # type: ignore[arg-type]
        description=data.get("description") or data.get("notes") or None,
        transaction_date=data.get("date") or data.get("transaction_date") or None,
        confidence=confidence,
    )


# ── POST /api/v1/ocr/receipt ──────────────────────────────────────────────────


@router.post(
    "/receipt",
    response_model=OCRResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract raw OCR text from a receipt image",
    description=(
        "Accepts a receipt image (PNG, JPEG, WEBP, max 10 MB) and returns "
        "the raw text extracted by Tesseract OCR. "
        "Use /ocr/receipt/parse for the combined OCR + AI structuring endpoint."
    ),
)
async def ocr_receipt(
    image: Annotated[UploadFile, File(description="Receipt image (PNG, JPEG, WEBP, max 10 MB)")],
    user_id: str = Depends(get_current_user_id),
) -> OCRResponse:
    """
    Run OCR on a receipt image and return the raw extracted text.

    Auth required. The image is processed entirely in memory and never stored.
    """
    logger.debug("OCR receipt | user=%s filename=%s", user_id, image.filename)

    image_bytes = await _read_and_validate_image(image)

    ocr = OCRService()
    try:
        text = ocr.extract_text(image_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_image", "message": str(exc)},
        )
    except RuntimeError as exc:
        logger.error("OCR runtime error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ocr_unavailable", "message": str(exc)},
        )

    return OCRResponse(text=text)


# ── POST /api/v1/ocr/receipt/parse ────────────────────────────────────────────


@router.post(
    "/receipt/parse",
    response_model=ReceiptParseResponse,
    status_code=status.HTTP_200_OK,
    summary="Parse a receipt image into a structured transaction",
    description=(
        "Accepts a receipt image, runs Tesseract OCR, then passes the extracted text "
        "to Gemini via the existing AI module. Returns a structured transaction object "
        "ready to pre-fill the Manual Transaction form. "
        "Returns 422 with code 'ocr_failure' if the image yields insufficient text."
    ),
)
async def ocr_receipt_parse(
    image: Annotated[UploadFile, File(description="Receipt image (PNG, JPEG, WEBP, max 10 MB)")],
    user_id: str = Depends(get_current_user_id),
    provider: AIProvider = Depends(get_provider),
) -> ReceiptParseResponse:
    """
    Combined OCR + AI parsing endpoint.

    Flow:
      1. Validate + read image
      2. Extract text via OCRService
      3. Check text is sufficient (≥ 20 chars)
      4. Build receipt_prompt() from existing prompt_templates
      5. Call AIService.generate_structured() — reuses existing AI infrastructure
      6. Map AI response → ReceiptParseResponse

    Auth required. The image is processed in memory and never persisted.
    """
    logger.debug(
        "OCR receipt/parse | user=%s filename=%s", user_id, image.filename
    )

    # Step 1 — validate + read
    image_bytes = await _read_and_validate_image(image)

    # Step 2 — OCR
    ocr = OCRService()
    try:
        ocr_text = ocr.extract_text(image_bytes)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "invalid_image", "message": str(exc)},
        )
    except RuntimeError as exc:
        logger.error("OCR runtime error during parse: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "ocr_unavailable", "message": str(exc)},
        )

    # Step 3 — check sufficiency
    if not ocr.is_sufficient(ocr_text):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "ocr_failure",
                "message": "Couldn't read this receipt.",
                "suggestions": OCR_FAILURE_SUGGESTIONS,
            },
        )

    # Step 4 — build prompt (reuses existing prompt_templates.receipt_prompt)
    prompt = receipt_prompt(ocr_text)

    # Step 5 — call existing AIService (no duplication)
    ai_svc = AIService(provider)
    try:
        structured = await ai_svc.generate_structured(prompt)
    except Exception as exc:
        logger.error("AI structuring failed during OCR parse: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={
                "code": "ai_error",
                "message": "Cortex could not structure the receipt data. Please try again.",
            },
        )

    # Step 6 — map AI response
    return _map_ai_response_to_parse_response(structured.data)
