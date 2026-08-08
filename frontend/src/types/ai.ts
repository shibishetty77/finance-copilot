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

export type AIMode = 'cloud' | 'byok';
export type AIProvider = 'openrouter' | 'gemini' | 'openai' | 'claude' | 'ollama';

export interface UpdateAISettingsRequest {
  mode?: AIMode;
  provider?: AIProvider;
  api_key?: string;
  base_url?: string;
  default_model?: string;
  assistant_model?: string;
  smart_entry_model?: string;
  ocr_model?: string;
  sms_model?: string;
  gmail_model?: string;
  investment_advisor_model?: string;
  cloud_fallback_enabled?: boolean;
}

export interface TestAISettingsRequest {
  mode: AIMode;
  provider?: AIProvider;
  api_key?: string;
  base_url?: string;
  model?: string;
}

export interface ListModelsRequest {
  provider: AIProvider;
  api_key?: string;
  base_url?: string;
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

export interface AISettingsResponse {
  mode: string;
  provider: string;
  masked_api_key: string | null;
  base_url: string | null;
  default_model: string | null;
  assistant_model: string | null;
  smart_entry_model: string | null;
  ocr_model: string | null;
  sms_model: string | null;
  gmail_model: string | null;
  investment_advisor_model: string | null;
  cloud_fallback_enabled: boolean;
}

export interface TestAISettingsResponse {
  connected: boolean;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  status: string;
  error: string | null;
}

export interface ListModelsResponse {
  models: string[];
}

// ── AI Finance Assistant types ────────────────────────────────────────────────

/** A single persisted chat message. */
export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

/** Request to send a message to the AI Finance Assistant. */
export interface AssistantChatRequest {
  message: string;
  conversation_id?: string;
}

/** Response from the AI Finance Assistant chat endpoint. */
export interface AssistantChatResponse {
  response: string;
  conversation_id: string;
  latency_ms: number;
  error?: string | null;
}

/** Full conversation history response. */
export interface AssistantHistoryResponse {
  messages: AssistantMessage[];
  conversation_id: string;
}

/** Response from clearing conversation history. */
export interface ClearHistoryResponse {
  deleted: number;
  conversation_id: string;
}

