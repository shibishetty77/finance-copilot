/**
 * Portfolio API functions — thin wrappers around the apiClient.
 * These map 1:1 to the backend /portfolio/* endpoints.
 */

import { apiClient } from './client';
import type {
  DiversificationScore,
  Holding,
  HoldingCreate,
  HoldingFilters,
  HoldingPaginationResponse,
  HoldingUpdate,
  MilestonesResponse,
  PerformanceAnalytics,
  PortfolioAllocation,
  PortfolioSummary,
  RiskScore,
} from '@/types/portfolio';

export const portfolioApi = {
  // Holdings CRUD
  createHolding: async (data: HoldingCreate): Promise<Holding> => {
    const res = await apiClient.post<Holding>('/portfolio/holdings', data);
    return res.data;
  },

  listHoldings: async (filters: HoldingFilters = {}): Promise<HoldingPaginationResponse> => {
    const res = await apiClient.get<HoldingPaginationResponse>('/portfolio/holdings', { params: filters });
    return res.data;
  },

  getHoldingById: async (id: string): Promise<Holding> => {
    const res = await apiClient.get<Holding>(`/portfolio/holdings/${id}`);
    return res.data;
  },

  updateHolding: async (id: string, data: HoldingUpdate): Promise<Holding> => {
    console.log('[UPDATE HOLDING] API call: PUT /portfolio/holdings/' + id, 'data:', data);
    const res = await apiClient.put<Holding>(`/portfolio/holdings/${id}`, data);
    console.log('[UPDATE HOLDING] API response:', res.data);
    return res.data;
  },

  deleteHolding: async (id: string): Promise<void> => {
    await apiClient.delete(`/portfolio/holdings/${id}`);
  },

  // Portfolio Metrics
  getSummary: async (): Promise<PortfolioSummary> => {
    const res = await apiClient.get<PortfolioSummary>('/portfolio/summary');
    return res.data;
  },

  getAllocation: async (): Promise<PortfolioAllocation> => {
    const res = await apiClient.get<PortfolioAllocation>('/portfolio/allocation');
    return res.data;
  },

  getDiversificationScore: async (): Promise<DiversificationScore> => {
    const res = await apiClient.get<DiversificationScore>('/portfolio/diversification');
    return res.data;
  },

  getRiskScore: async (): Promise<RiskScore> => {
    const res = await apiClient.get<RiskScore>('/portfolio/risk');
    return res.data;
  },

  getPerformanceAnalytics: async (): Promise<PerformanceAnalytics> => {
    const res = await apiClient.get<PerformanceAnalytics>('/portfolio/performance');
    return res.data;
  },

  getMilestones: async (): Promise<MilestonesResponse> => {
    const res = await apiClient.get<MilestonesResponse>('/portfolio/milestones');
    return res.data;
  },
};
