/**
 * AI Smart Entry — prompt builder and response parser.
 *
 * Architecture rule: The prompt lives here, not in the component.
 * This module is the single place to iterate on the extraction quality.
 *
 * Future AI parsers (SMS, OCR, Statement) will each have their own
 * equivalent utility module, all feeding into the same ParsedTransaction type.
 */

import type { ParsedTransaction } from '@/types/transaction-parser';

// ── Prompt builder ─────────────────────────────────────────────────────────────

/**
 * Build a prompt that instructs the AI to extract a structured transaction
 * from a single free-form sentence.
 *
 * @param text  The user's natural-language description.
 * @param today ISO date string for "today" (YYYY-MM-DD), used to resolve
 *              relative dates like "yesterday", "last week".
 */
export function buildTransactionPrompt(text: string, today: string): string {
  return `You are a financial data extraction assistant for an Indian personal finance app called CortexFi.

Today's date is ${today}.

The user has described a transaction in natural language. Extract the structured information and return it as a single JSON object.

User input: "${text}"

Available category names (use exactly one from this list, or null):
Food, Groceries, Transport, Rent, Utilities, Shopping, Entertainment,
Healthcare, Education, Investments, Subscriptions, Miscellaneous,
Income, Salary, Freelance, Business, Other Income

Return a JSON object with EXACTLY these fields:
{
  "amount": <number in INR, or null if not mentioned>,
  "merchant": <string merchant/payee name, or null>,
  "category": <string from the list above, or null>,
  "type": <"expense" or "income" — never null, infer from context>,
  "description": <short 1-5 word memo, or null>,
  "transaction_date": <ISO date YYYY-MM-DD resolved from today's date, or null>,
  "confidence": <float 0.0–1.0 representing your confidence in the overall extraction>
}

Rules:
- For amounts, extract numeric value only (e.g. "₹540" → 540).
- For dates: "yesterday" → ${getPreviousDay(today)}, "today" → ${today}, resolve all relative references.
- Payments/bills/purchases/bought = "expense". Received/salary/credited = "income".
- Confidence should be 0.95+ when amount and type are clear, 0.7–0.94 when some info is ambiguous, below 0.7 when key info is missing.
- Respond with valid JSON ONLY. No markdown, no explanation, no code fences.`;
}

/** Returns the ISO date string for the day before `today`. */
function getPreviousDay(today: string): string {
  try {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  } catch {
    return today;
  }
}

// ── Response parser ────────────────────────────────────────────────────────────

/**
 * Parse the AI's plain-text response into a `ParsedTransaction`.
 *
 * The AI is instructed to return JSON only, but may occasionally wrap it
 * in markdown fences or add extra text. This function handles those cases.
 *
 * @throws {Error} If the response contains no valid JSON object.
 */
export function parseTransactionResponse(responseText: string): ParsedTransaction {
  // Strip markdown code fences if present (```json ... ``` or ``` ... ```)
  let cleaned = responseText.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Find the first JSON object in the text
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON object found in AI response.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('AI response contained malformed JSON.');
  }

  // Normalise and coerce each field
  const amount = typeof parsed.amount === 'number' && parsed.amount > 0
    ? parsed.amount
    : null;

  const merchant = typeof parsed.merchant === 'string' && parsed.merchant.trim()
    ? parsed.merchant.trim()
    : null;

  const category = typeof parsed.category === 'string' && parsed.category.trim()
    ? parsed.category.trim()
    : null;

  const rawType = typeof parsed.type === 'string' ? parsed.type.toLowerCase() : '';
  const type: 'income' | 'expense' | null =
    rawType === 'income' ? 'income' :
    rawType === 'expense' ? 'expense' :
    null;

  const description = typeof parsed.description === 'string' && parsed.description.trim()
    ? parsed.description.trim()
    : null;

  const transaction_date = typeof parsed.transaction_date === 'string' && parsed.transaction_date.trim()
    ? parsed.transaction_date.trim()
    : null;

  const rawConfidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;
  const confidence = Math.max(0, Math.min(1, rawConfidence));

  return {
    amount,
    merchant,
    category,
    type,
    description,
    transaction_date,
    confidence,
  };
}

// ── Confidence helpers ─────────────────────────────────────────────────────────

export type ConfidenceLevel = 'high' | 'medium' | 'low';

/** Map a 0–1 confidence float to a semantic level. */
export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence > 0.9) return 'high';
  if (confidence >= 0.7) return 'medium';
  return 'low';
}

/** Display label for the confidence score. */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}% Confidence`;
}
