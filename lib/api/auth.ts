import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { tokenStorage, userStorage } from '@/lib/utils/storage';
import { AuthResponse, User } from '@/types';

/**
 * Authentication API Service
 */
export const authApi = {
  /**
   * Login with email and password
   */
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
      email,
      password,
    });

    // Store token and user data
    tokenStorage.set(response.token);
    userStorage.set(response.user);

    return response;
  },

  /**
   * Sign up new customer
   */
  signup: async (name: string, email: string, password: string): Promise<AuthResponse> => {
    const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.SIGNUP, {
      name,
      email,
      password,
    });

    // Store token and user data
    tokenStorage.set(response.token);
    userStorage.set(response.user);

    return response;
  },

  /**
   * Get current user info
   */
  getCurrentUser: async (): Promise<User> => {
    return apiClient.get<User>(API_ENDPOINTS.AUTH.ME);
  },

  /**
   * Logout (clear local storage)
   */
  logout: async (): Promise<void> => {
    try {
      await apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
    } catch (error) {
      // Even if API call fails, clear local storage
      console.error('Logout API error:', error);
    } finally {
      tokenStorage.remove();
      userStorage.remove();
    }
  },
};

