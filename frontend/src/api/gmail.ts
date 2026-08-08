import { apiClient } from './client';

export interface GmailAuthStatus {
  connected: boolean;
  email?: string;
}

export interface GmailTransactionCandidate {
  gmail_message_id: string;
  subject: string;
  sender: string;
  date: string;
  merchant?: string;
  amount?: number;
  currency: string;
  type: 'income' | 'expense';
  payment_method?: string;
  category?: string;
  description?: string;
  confidence: number;
  status: 'Ready' | 'Duplicate';
}

export interface GmailScanResponse {
  total_scanned: number;
  transactions: GmailTransactionCandidate[];
}

export interface GmailImportItem {
  gmail_message_id: string;
  merchant?: string;
  amount: number;
  type: 'income' | 'expense';
  date: string;
  payment_method?: string;
  category?: string;
  description?: string;
}

export interface GmailImportResponse {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
}

export const gmailApi = {
  getAuthUrl: async (): Promise<{ url: string }> => {
    const { data } = await apiClient.get<{ url: string }>('/gmail/auth-url');
    return data;
  },

  callback: async (code: string): Promise<{ status: string; email: string }> => {
    const { data } = await apiClient.post<{ status: string; email: string }>(`/gmail/callback?code=${encodeURIComponent(code)}`);
    return data;
  },

  getStatus: async (): Promise<GmailAuthStatus> => {
    const { data } = await apiClient.get<GmailAuthStatus>('/gmail/status');
    return data;
  },

  disconnect: async (): Promise<{ status: string }> => {
    const { data } = await apiClient.post<{ status: string }>('/gmail/disconnect');
    return data;
  },

  scan: async (days: number): Promise<GmailScanResponse> => {
    const { data } = await apiClient.post<GmailScanResponse>('/gmail/scan', { days });
    return data;
  },

  importTransactions: async (transactions: GmailImportItem[]): Promise<GmailImportResponse> => {
    const { data } = await apiClient.post<GmailImportResponse>('/gmail/import', { transactions });
    return data;
  },
};
