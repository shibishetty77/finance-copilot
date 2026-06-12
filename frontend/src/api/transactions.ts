/**
 * Transactions API functions — thin wrappers around the apiClient.
 * These map 1:1 to the backend /transactions/* endpoints.
 */

import { apiClient } from './client';
import type {
  Transaction,
  TransactionCreate,
  TransactionFilters,
  TransactionMonthlySummary,
  TransactionPaginationResponse,
  TransactionUpdate,
} from '@/types/transaction';

export const transactionsApi = {
  create: async (data: TransactionCreate): Promise<Transaction> => {
    const res = await apiClient.post<Transaction>('/transactions', data);
    return res.data;
  },

  list: async (filters: TransactionFilters = {}): Promise<TransactionPaginationResponse> => {
    const res = await apiClient.get<TransactionPaginationResponse>('/transactions', { params: filters });
    return res.data;
  },

  getById: async (id: string): Promise<Transaction> => {
    const res = await apiClient.get<Transaction>(`/transactions/${id}`);
    return res.data;
  },

  update: async (id: string, data: TransactionUpdate): Promise<Transaction> => {
    const res = await apiClient.put<Transaction>(`/transactions/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/transactions/${id}`);
  },

  getMonthlySummary: async (): Promise<TransactionMonthlySummary[]> => {
    const res = await apiClient.get<TransactionMonthlySummary[]>('/transactions/summary/monthly');
    return res.data;
  },
};
