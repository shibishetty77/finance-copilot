/**
 * OCR types — Receipt scan response shapes.
 *
 * The ReceiptParseResponse mirrors ParsedTransaction so the same
 * review screen can display data from both AI Smart Entry and Receipt OCR.
 */

/** Structured transaction extracted from a receipt via OCR + Gemini. */
export interface ReceiptParseResponse {
  merchant: string | null;
  amount: number | null;
  category: string | null;
  type: 'income' | 'expense' | null;
  description: string | null;
  transaction_date: string | null;
  /** AI confidence score 0–1. */
  confidence: number;
}

/** Raw OCR text response from POST /api/v1/ocr/receipt */
export interface OCRTextResponse {
  text: string;
}

/** Detail object returned in OCR failure 422 responses. */
export interface OCRFailureDetail {
  code: 'ocr_failure' | 'invalid_file_type' | 'file_too_large' | 'invalid_image' | 'ai_error' | 'ocr_unavailable';
  message: string;
  suggestions?: string[];
}
