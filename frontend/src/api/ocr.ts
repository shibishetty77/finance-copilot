/**
 * OCR API client — the ONLY frontend entry point for receipt scanning.
 *
 * Architecture rule: No other file should call /ocr/* endpoints directly.
 *
 * Endpoints:
 *   scanReceipt()  → POST /api/v1/ocr/receipt/parse
 *
 * The combined parse endpoint handles OCR + AI server-side, so the
 * frontend makes a single request and receives a structured transaction.
 */

import { apiClient } from './client';
import type { ReceiptParseResponse } from '@/types/ocr';

export const ocrApi = {
  /**
   * Upload a receipt image and receive a structured transaction.
   *
   * The server runs Tesseract OCR then Gemini on the image — the frontend
   * never needs to know about either. Authentication is handled automatically
   * by the apiClient interceptor.
   *
   * @param formData - FormData with field `image` containing the receipt file.
   * @returns Structured transaction data ready to pre-fill the transaction form.
   *
   * @throws 422 with code "ocr_failure" if image yields insufficient text.
   * @throws 400 with code "invalid_file_type" or "file_too_large" on bad input.
   * @throws 502 with code "ai_error" if Gemini structuring fails.
   */
  scanReceipt: async (formData: FormData): Promise<ReceiptParseResponse> => {
    const res = await apiClient.post<ReceiptParseResponse>(
      '/ocr/receipt/parse',
      formData,
      {
        headers: {
          // Let the browser set Content-Type with the multipart boundary.
          // Explicitly setting it here would break the boundary string.
          'Content-Type': undefined,
        },
      },
    );
    return res.data;
  },
};
