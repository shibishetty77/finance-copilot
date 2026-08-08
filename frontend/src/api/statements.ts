import { apiClient } from './client';

export interface ParsedTransactionRow {
  date: string | null;
  description: string | null;
  merchant: string | null;
  amount: number | null;
  type: 'income' | 'expense' | null;
  status: 'Ready' | 'Duplicate' | 'Missing Data' | 'Invalid';
  original_row: Record<string, string>;
  selected?: boolean; // frontend state
}

export interface StatementImportPreview {
  total_rows: number;
  transactions: ParsedTransactionRow[];
}

export interface StatementImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
}

export const statementApi = {
  uploadCSV: async (file: File): Promise<StatementImportPreview> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post<StatementImportPreview>(
      '/statements/import',
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  },

  confirmImport: async (
    transactions: ParsedTransactionRow[]
  ): Promise<StatementImportResult> => {
    const response = await apiClient.post<StatementImportResult>(
      '/statements/import/confirm',
      { transactions }
    );
    return response.data;
  },
};
