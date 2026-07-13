/**
 * AI Smart Entry — parsed transaction type.
 *
 * This is the structured output produced when the AI parses a user's
 * natural-language transaction description.
 *
 * All fields are nullable because the AI may not be able to confidently
 * extract every piece of information from every description.
 *
 * Future parsers (SMS, OCR, Statement, Gmail) will reuse this exact shape
 * as the canonical "pre-fill" contract with the Manual Transaction form.
 */

export interface ParsedTransaction {
  /** Transaction amount in INR. Null if the AI could not extract it. */
  amount: number | null;

  /** Merchant / payee name (e.g. "McDonald's", "Uber"). */
  merchant: string | null;

  /**
   * Human-readable category name that matches one of the backend's
   * DEFAULT_CATEGORIES (e.g. "Food", "Transport", "Salary").
   * The UI maps this to a numeric category_id via CATEGORIES.
   */
  category: string | null;

  /** Whether this is money going out (expense) or coming in (income). */
  type: 'income' | 'expense' | null;

  /** Short description / memo for the transaction. */
  description: string | null;

  /** ISO date string YYYY-MM-DD inferred from the user's text. */
  transaction_date: string | null;

  /**
   * Confidence score between 0 and 1.
   * Used to colour-code the review badge:
   *   > 0.90  → green
   *   0.70–0.90 → yellow
   *   < 0.70  → red
   */
  confidence: number;
}
