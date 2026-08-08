/**
 * AI API client — the ONLY frontend entry point for all AI features.
 *
 * Architecture rule: No other file in the frontend should call AI endpoints
 * directly. All AI interactions must go through this client.
 *
 * Current endpoints:
 *   health()          → GET  /api/v1/ai/health   (public)
 *   generate()        → POST /api/v1/ai/generate (auth required)
 *   getSettings()     → GET /api/v1/ai/settings (auth required)
 *   updateSettings()  → PUT /api/v1/ai/settings (auth required)
 *   testSettings()    → POST /api/v1/ai/test (auth required)
 *   listModels()      → POST /api/v1/ai/models (auth required)
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
  StructuredRequest,
  StructuredResponse,
  AISettingsResponse,
  UpdateAISettingsRequest,
  TestAISettingsRequest,
  TestAISettingsResponse,
  ListModelsRequest,
  ListModelsResponse,
  AssistantChatRequest,
  AssistantChatResponse,
  AssistantHistoryResponse,
  ClearHistoryResponse,
} from '@/types/ai';

export interface ParseSmsRequest {
  message: string;
}

export interface ParsedSmsResponse {
  description: string | null;
  merchant_name: string | null;
  amount: number | null;
  transaction_type: string | null;
  transaction_date: string | null;
  category: string | null;
  payment_method: string | null;
  confidence: number;
}

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

  /**
   * Get user's AI settings.
   */
  getSettings: async (): Promise<AISettingsResponse> => {
    const res = await apiClient.get<AISettingsResponse>('/ai/settings');
    return res.data;
  },

  /**
   * Update user's AI settings.
   */
  updateSettings: async (request: UpdateAISettingsRequest): Promise<AISettingsResponse> => {
    const res = await apiClient.put<AISettingsResponse>('/ai/settings', request);
    return res.data;
  },

  /**
   * Test AI settings.
   */
  testSettings: async (request: TestAISettingsRequest): Promise<TestAISettingsResponse> => {
    const res = await apiClient.post<TestAISettingsResponse>('/ai/test', request);
    return res.data;
  },

  /**
   * List available models for a provider.
   */
  listModels: async (request: ListModelsRequest): Promise<ListModelsResponse> => {
    const res = await apiClient.post<ListModelsResponse>('/ai/models', request);
    return res.data;
  },

  // ── Future stubs ───────────────────────────────────────────────────────────
  // These methods are declared here so all future imports target this file.
  // Implement them when the corresponding backend endpoints are built.

  /**
   * AI Finance Assistant — send a message and get a response.
   *
   * The backend builds financial context from the user's data,
   * calls Ollama, persists the exchange, and returns the assistant's reply.
   *
   * Endpoint: POST /api/v1/ai/assistant/chat
   */
  assistant: async (request: AssistantChatRequest): Promise<AssistantChatResponse> => {
    const res = await apiClient.post<AssistantChatResponse>('/ai/assistant/chat', request);
    return res.data;
  },

  /**
   * Load the full conversation history for the current user.
   *
   * Endpoint: GET /api/v1/ai/assistant/history
   */
  getHistory: async (): Promise<AssistantHistoryResponse> => {
    const res = await apiClient.get<AssistantHistoryResponse>('/ai/assistant/history');
    return res.data;
  },

  /**
   * Clear all conversation history for the current user.
   *
   * Endpoint: DELETE /api/v1/ai/assistant/history
   */
  clearHistory: async (): Promise<ClearHistoryResponse> => {
    const res = await apiClient.delete<ClearHistoryResponse>('/ai/assistant/history');
    return res.data;
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
   * Receipt OCR — implemented in @/api/ocr.ts (ocrApi.scanReceipt).
   *
   * The combined OCR + AI endpoint lives at POST /api/v1/ocr/receipt/parse.
   * Use ocrApi.scanReceipt(formData) instead of this method.
   *
   * @deprecated Use ocrApi from '@/api/ocr' directly.
   */
  ocr: async (_request: StructuredRequest): Promise<StructuredResponse> => {
    throw new Error(
      'aiApi.ocr() is deprecated. Use ocrApi.scanReceipt() from @/api/ocr instead.'
    );
  },

  /**
   * SMS Parsing — extract transaction from a bank SMS alert.
   * Endpoint: POST /api/v1/messages/parse
   */
  parseSms: async (request: ParseSmsRequest): Promise<ParsedSmsResponse> => {
    const res = await apiClient.post<ParsedSmsResponse>('/messages/parse', request);
    return res.data;
  },

  /**
   * @future Statement Import — parse a bank statement into transactions.
   * Endpoint: POST /api/v1/ai/parseStatement
   */
  parseStatement: async (_request: AIRequest): Promise<StructuredResponse> => {
    throw new Error(
      'aiApi.parseStatement() is not yet implemented. ' +
      'It will be available when the Bank Statement Import feature is built.'
    );
  },
};
