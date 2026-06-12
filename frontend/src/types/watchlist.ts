/**
 * TypeScript types for watchlist.
 */

export interface Watchlist {
  id: string;
  user_id: string;
  symbol: string;
  company_name: string | null;
  sector: string | null;
  notes: string | null;
  created_at: string;
}

export interface WatchlistCreate {
  symbol: string;
  company_name?: string;
  sector?: string;
  notes?: string;
}

export interface WatchlistUpdate {
  symbol?: string;
  company_name?: string;
  sector?: string;
  notes?: string;
}

export interface WatchlistFilters {
  search?: string;
  page?: number;
  page_size?: number;
}

export interface WatchlistPaginationResponse {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  items: Watchlist[];
}
