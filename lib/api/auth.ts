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
    try {
      console.log('[AUTH API] Attempting login for:', email);
      const response = await apiClient.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, {
        email,
        password,
      });

      if (!response || !response.token) {
        throw new Error('Invalid response from server: missing token');
      }

      if (!response.user) {
        throw new Error('Invalid response from server: missing user data');
      }

      console.log('[AUTH API] Login successful, user role:', response.user.role);

      // Store token and user data
      tokenStorage.set(response.token);
      userStorage.set(response.user);

      return response;
    } catch (error: any) {
      console.error('[AUTH API] Login error:', error);
      // Re-throw with better error message
      if (error.message) {
        throw error;
      }
      throw new Error('Login failed. Please check your credentials and try again.');
    }
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
    try {
      console.log('[AUTH API] Fetching current user...');
      const user = await apiClient.get<User>(API_ENDPOINTS.AUTH.ME);
      console.log('[AUTH API] Current user fetched, role:', user?.role);
      return user;
    } catch (error: any) {
      console.error('[AUTH API] getCurrentUser error:', error);
      throw error;
    }
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

