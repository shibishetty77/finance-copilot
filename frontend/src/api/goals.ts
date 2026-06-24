/**
 * Goals API functions — thin wrappers around the apiClient.
 */

import { apiClient } from './client';
import type { Goal, GoalCreate, GoalUpdate } from '@/types/goal';

export const goalsApi = {
  create: async (data: GoalCreate): Promise<Goal> => {
    const res = await apiClient.post<Goal>('/goals', data);
    return res.data;
  },

  list: async (): Promise<Goal[]> => {
    const res = await apiClient.get<Goal[]>('/goals');
    return res.data;
  },

  getById: async (id: string): Promise<Goal> => {
    const res = await apiClient.get<Goal>(`/goals/${id}`);
    return res.data;
  },

  update: async (id: string, data: GoalUpdate): Promise<Goal> => {
    const res = await apiClient.put<Goal>(`/goals/${id}`, data);
    return res.data;
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/goals/${id}`);
  },
};
