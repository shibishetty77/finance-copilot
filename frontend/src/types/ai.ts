/**
 * AI module — TypeScript type definitions.
 *
 * These interfaces mirror the Pydantic schemas defined in
 * backend/app/modules/ai/schemas.py.
 *
 * All future AI feature types (OCR, SMS, Statement, etc.) should extend
 * these base types rather than defining their own response shapes.
 */

// ── Request types ─────────────────────────────────────────────────────────────

/** Plain text generation request. */
export interface AIRequest {
  /** The prompt to send to the AI provider. */
  prompt: string;
  /** Optional system-level context prepended to the prompt. */
  context?: string;
}

/** Structured JSON generation request. */
export interface StructuredRequest {
  prompt: string;
  context?: string;
  /** Optional JSON Schema to validate the structured response against. */
  response_schema?: Record<string, unknown>;
}

/** A single message in a multi-turn conversation. */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/** Multi-turn conversation request. */
export interface ChatRequest {
  messages: ChatMessage[];
  context?: string;
}

// ── Response types ────────────────────────────────────────────────────────────

/** Response from a plain text generation call. */
export interface AIResponse {
  /** The AI-generated text. */
  response: string;
  /** Provider used, e.g. "gemini". */
  provider: string;
  /** Model used, e.g. "gemini-2.5-flash". */
  model: string;
  /** Total tokens consumed (prompt + completion), if available. */
  tokens_used: number | null;
  /** Round-trip latency in milliseconds. */
  latency_ms: number;
}

/** Response from a structured JSON generation call. */
export interface StructuredResponse {
  /** Parsed JSON object returned by the AI provider. */
  data: Record<string, unknown>;
  provider: string;
  model: string;
  tokens_used: number | null;
  latency_ms: number;
}

/** Response from a multi-turn chat call. */
export interface ChatResponse {
  /** The assistant's reply text. */
  response: string;
  provider: string;
  model: string;
  tokens_used: number | null;
  latency_ms: number;
}

/** Health check response. */
export interface AIHealthResponse {
  /** Configured AI provider name, e.g. "gemini". */
  provider: string;
  /** Configured model name, e.g. "gemini-2.5-flash". */
  model: string;
  /** "ready" if the provider is correctly configured, "misconfigured" otherwise. */
  status: 'ready' | 'misconfigured';
}
