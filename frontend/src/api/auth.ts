/**
 * Auth API functions — thin wrappers around the apiClient.
 * These map 1:1 to the backend /auth/* endpoints.
 */

import { apiClient } from './client';
import type {
  ChangePasswordRequest,
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  RegisterResponse,
  TokenResponse,
  UpdateProfileRequest,
  User,
} from '@/types/auth';

export const authApi = {
  register: async (data: RegisterRequest): Promise<RegisterResponse> => {
    const res = await apiClient.post<RegisterResponse>('/auth/register', data);
    return res.data;
  },

  login: async (data: LoginRequest): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>('/auth/login', data);
    return res.data;
  },

  refresh: async (): Promise<TokenResponse> => {
    const res = await apiClient.post<TokenResponse>('/auth/refresh');
    return res.data;
  },

  logout: async (): Promise<MessageResponse> => {
    const res = await apiClient.post<MessageResponse>('/auth/logout');
    return res.data;
  },

  getMe: async (): Promise<User> => {
    const res = await apiClient.get<User>('/auth/me');
    return res.data;
  },

  updateMe: async (data: UpdateProfileRequest): Promise<User> => {
    const res = await apiClient.patch<User>('/auth/me', data);
    return res.data;
  },

  changePassword: async (data: ChangePasswordRequest): Promise<MessageResponse> => {
    const res = await apiClient.post<MessageResponse>('/auth/change-password', data);
    return res.data;
  },
};
