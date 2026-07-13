/**
 * AI API client — the ONLY frontend entry point for all AI features.
 *
 * Architecture rule: No other file in the frontend should call AI endpoints
 * directly. All AI interactions must go through this client.
 *
 * Current endpoints:
 *   health()          → GET  /api/v1/ai/health   (public)
 *   generate()        → POST /api/v1/ai/generate (auth required)
 *   parseTransaction() → POST /api/v1/ai/generate (auth required, Smart Entry)
 *
 * Future stubs (implemented when the features are built):
 *   assistant()      — AI Financial Assistant
 *   ocr()            — Receipt OCR
 *   parseSms()       — SMS bank alert parsing
 *   parseStatement() — Bank statement import
 */

import { apiClient } from './client';
import type {
  AIHealthResponse,
  AIRequest,
  AIResponse,
  ChatRequest,
  ChatResponse,
  StructuredRequest,
  StructuredResponse,
} from '@/types/ai';

/**
 * The single AI API client object.
 *
 * Usage:
 *   import { aiApi } from '@/api/ai';
 *   const health = await aiApi.health();
 *   const result = await aiApi.generate({ prompt: 'Summarise my spending' });
 */
export const aiApi = {
  // ── Implemented endpoints ──────────────────────────────────────────────────

  /**
   * Check the AI layer health status.
   *
   * Public — no authentication required.
   * Does NOT call the LLM; only validates configuration.
   *
   * @returns Provider name, model name, and "ready" | "misconfigured" status.
   */
  health: async (): Promise<AIHealthResponse> => {
    const res = await apiClient.get<AIHealthResponse>('/ai/health');
    return res.data;
  },

  /**
   * Generate AI text from a prompt.
   *
   * Requires a valid Bearer token (set automatically by the apiClient
   * interceptor once the user is logged in).
   *
   * @param request - The prompt and optional context.
   * @returns AI-generated text with provider metadata and latency.
   */
  generate: async (request: AIRequest): Promise<AIResponse> => {
    const res = await apiClient.post<AIResponse>('/ai/generate', request);
    return res.data;
  },

  // ── Future stubs ───────────────────────────────────────────────────────────
  // These methods are declared here so all future imports target this file.
  // Implement them when the corresponding backend endpoints are built.

  /**
   * @future AI Financial Assistant — multi-turn conversation.
   * Endpoint: POST /api/v1/ai/assistant
   */
  assistant: async (_request: ChatRequest): Promise<ChatResponse> => {
    throw new Error(
      'aiApi.assistant() is not yet implemented. ' +
      'It will be available when the AI Assistant feature is built.'
    );
  },

  /**
   * Smart Entry — parse a natural-language transaction description.
   *
   * Sends the description as a prompt to the existing /ai/generate endpoint.
   * The caller is responsible for building the prompt (via buildTransactionPrompt)
   * and parsing the JSON response (via parseTransactionResponse).
   *
   * Endpoint: POST /api/v1/ai/generate
   */
  parseTransaction: async (request: AIRequest): Promise<AIResponse> => {
    const res = await apiClient.post<AIResponse>('/ai/generate', request);
    return res.data;
  },

  /**
   * @future Receipt OCR — extract transaction data from a receipt image.
   * Endpoint: POST /api/v1/ai/ocr
   */
  ocr: async (_request: StructuredRequest): Promise<StructuredResponse> => {
    throw new Error(
      'aiApi.ocr() is not yet implemented. ' +
      'It will be available when the Receipt OCR feature is built.'
    );
  },

  /**
   * @future SMS Parsing — extract transaction from a bank SMS alert.
   * Endpoint: POST /api/v1/ai/parse-sms
   */
  parseSms: async (_request: AIRequest): Promise<StructuredResponse> => {
    throw new Error(
      'aiApi.parseSms() is not yet implemented. ' +
      'It will be available when the SMS Parsing feature is built.'
    );
  },

  /**
   * @future Statement Import — parse a bank statement into transactions.
   * Endpoint: POST /api/v1/ai/parse-statement
   */
  parseStatement: async (_request: AIRequest): Promise<StructuredResponse> => {
    throw new Error(
      'aiApi.parseStatement() is not yet implemented. ' +
      'It will be available when the Bank Statement Import feature is built.'
    );
  },
};
