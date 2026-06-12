/**
 * Watchlist API functions — thin wrappers around the apiClient.
 * These map 1:1 to the backend /portfolio/watchlist/* endpoints.
 */

import { apiClient } from './client';
import type {
  Watchlist,
  WatchlistCreate,
  WatchlistFilters,
  WatchlistPaginationResponse,
  WatchlistUpdate,
} from '@/types/watchlist';

export const watchlistApi = {
  create: async (data: WatchlistCreate): Promise<Watchlist> => {
    const res = await apiClient.post<Watchlist>('/portfolio/watchlist', data);
    return res.data;
  },

  list: async (filters: WatchlistFilters = {}): Promise<WatchlistPaginationResponse> => {
    const res = await apiClient.get<WatchlistPaginationResponse>('/portfolio/watchlist', { params: filters });
    return res.data;
  },

  getById: async (id: string): Promise<Watchlist> => {
    const res = await apiClient.get<Watchlist>(`/portfolio/watchlist/${id}`);
    return res.data;
  },

  update: async (id: string, data: WatchlistUpdate): Promise<Watchlist> => {
    const res = await apiClient.put<Watchlist>(`/portfolio/watchlist/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/portfolio/watchlist/${id}`);
  },
};
