"""
OCR module — OCRService: a generic, reusable image-to-text service.

Architecture rule: This service is deliberately AI-free.
It accepts raw image bytes and returns extracted plain text.
Callers (e.g. the OCR router) are responsible for deciding what to do
with the text (pass it to AI, store it, etc.).

This design lets future features (invoice OCR, bill OCR, ID card OCR)
reuse this service without pulling in any transaction or AI logic.

Usage:
    service = OCRService()
    text = service.extract_text(image_bytes)
"""

import io
import logging

logger = logging.getLogger(__name__)

# Minimum character threshold to consider OCR successful.
# Receipts shorter than this are almost certainly blank or garbled.
_MIN_TEXT_LENGTH = 20


class OCRService:
    """
    Generic image-to-text OCR service backed by Tesseract via pytesseract.

    The service preprocesses the image with Pillow before running Tesseract
    to improve accuracy on low-contrast or small-text receipts.

    All processing happens in memory — no files are written to disk.
    """

    def __init__(self) -> None:
        import os
        from app.config import settings

        try:
            import pytesseract
        except ImportError as exc:
            raise RuntimeError(
                "pytesseract is not installed. Run: pip install pytesseract"
            ) from exc

        if settings.TESSERACT_CMD:
            if not os.path.exists(settings.TESSERACT_CMD):
                raise RuntimeError(
                    "Tesseract executable not found. Please verify TESSERACT_CMD."
                )
            pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD
            logger.info("Using Tesseract from: %s", settings.TESSERACT_CMD)
        else:
            logger.info("Using system PATH for Tesseract.")

    def extract_text(self, image_bytes: bytes) -> str:
        """
        Extract plain text from image bytes using Tesseract OCR.

        Args:
            image_bytes: Raw bytes of the image (PNG, JPEG, or WEBP).

        Returns:
            Extracted text string (may be empty if image is blank/unreadable).

        Raises:
            ValueError: If the bytes cannot be decoded as a valid image.
            RuntimeError: If Tesseract is not installed on the system.
        """
        try:
            from PIL import Image
        except ImportError as exc:
            raise RuntimeError(
                "Pillow is not installed. Run: pip install pillow"
            ) from exc

        try:
            import pytesseract
        except ImportError as exc:
            raise RuntimeError(
                "pytesseract is not installed. Run: pip install pytesseract"
            ) from exc

        # Decode bytes → PIL Image
        try:
            image = Image.open(io.BytesIO(image_bytes))
        except Exception as exc:
            raise ValueError(
                f"Could not decode image: {exc}. "
                "Ensure the file is a valid PNG, JPEG, or WEBP."
            ) from exc

        # Preprocess for better OCR accuracy:
        #   1. Convert to RGB (handles RGBA PNGs, CMYK JPEGs, etc.)
        #   2. Convert to greyscale — Tesseract works best on greyscale
        image = image.convert("RGB").convert("L")  # type: ignore[assignment]

        # Run Tesseract
        try:
            text: str = pytesseract.image_to_string(image, lang="eng")
        except pytesseract.TesseractNotFoundError as exc:
            raise RuntimeError(
                "Tesseract OCR binary is not installed or not on PATH. "
                "Install it from: https://github.com/UB-Mannheim/tesseract/wiki "
                "(Windows: winget install UB-Mannheim.TesseractOCR)"
            ) from exc
        except Exception as exc:
            logger.error("Tesseract error: %s", exc)
            raise RuntimeError(f"OCR processing failed: {exc}") from exc

        extracted = text.strip()
        
        # Sanitize text to prevent downstream JSON parse errors in AI modules
        # OCR often misreads specks as quotes or slashes, causing the LLM to output unescaped syntax.
        extracted = extracted.replace('"', "'").replace('\\', "/")

        logger.info(
            "OCR extraction complete | chars=%d | sufficient=%s",
            len(extracted),
            len(extracted) >= _MIN_TEXT_LENGTH,
        )
        return extracted

    def is_sufficient(self, text: str) -> bool:
        """Return True if the extracted text is long enough to be useful."""
        return len(text.strip()) >= _MIN_TEXT_LENGTH
