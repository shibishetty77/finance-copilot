/**
 * TypeScript types for transactions.
 * These mirror the backend Pydantic schemas exactly.
 */

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  color: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'income' | 'expense';
  category_id: number | null;
  category: Category | null;
  description: string | null;
  transaction_date: string; // ISO date string
  notes: string | null;
  tags: string[] | null;
  is_recurring: boolean;
  recurrence_type: 'monthly' | 'weekly' | 'yearly' | null;
  merchant_name: string | null;
  transaction_source: 'manual' | 'csv_import' | 'bank_import' | 'upi_import' | 'ai_generated';
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
}

export interface TransactionCreate {
  description?: string;
  amount: number;
  type: 'income' | 'expense';
  category_id?: number;
  transaction_date: string; // ISO date string
  notes?: string;
  tags?: string[];
  is_recurring?: boolean;
  recurrence_type?: 'monthly' | 'weekly' | 'yearly';
  merchant_name?: string;
}

export interface TransactionUpdate {
  description?: string;
  amount?: number;
  type?: 'income' | 'expense';
  category_id?: number;
  transaction_date?: string;
  notes?: string;
  tags?: string[];
  is_recurring?: boolean;
  recurrence_type?: 'monthly' | 'weekly' | 'yearly';
  merchant_name?: string;
}

export interface TransactionMonthlySummary {
  month: string; // Format: "2026-06"
  income: number;
  expenses: number;
  savings: number;
}

export interface TransactionPaginationResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Transaction[];
}

export interface TransactionFilters {
  category_id?: number;
  type?: 'income' | 'expense';
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  search?: string;
  page?: number;
  page_size?: number;
}
