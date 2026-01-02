import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/lib/utils/constants';
import { tokenStorage, clearAuth } from '@/lib/utils/storage';
import { ApiResponse } from '@/types';

/**
 * Axios instance with base configuration
 * Handles authentication token injection and error handling
 */
class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 seconds
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor: Add auth token to all requests
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = tokenStorage.get();
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor: Handle errors globally
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiResponse<unknown>>) => {
        // Handle 401 Unauthorized - clear auth and redirect to login
        if (error.response?.status === 401) {
          clearAuth();
          if (typeof window !== 'undefined') {
            window.location.href = '/auth/login';
          }
        }

        // Return error in consistent format
        return Promise.reject({
          message: error.response?.data?.message || error.message || 'An error occurred',
          status: error.response?.status,
          data: error.response?.data,
        });
      }
    );
  }

  /**
   * Get the axios instance
   */
  getInstance(): AxiosInstance {
    return this.client;
  }

  /**
   * GET request
   */
  async get<T>(url: string, config?: InternalAxiosRequestConfig): Promise<T> {
    const response = await this.client.get<ApiResponse<T>>(url, config);
    return response.data.data as T;
  }

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, config?: InternalAxiosRequestConfig): Promise<T> {
    const response = await this.client.post<ApiResponse<T>>(url, data, config);
    return response.data.data as T;
  }

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, config?: InternalAxiosRequestConfig): Promise<T> {
    const response = await this.client.put<ApiResponse<T>>(url, data, config);
    return response.data.data as T;
  }

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, config?: InternalAxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<ApiResponse<T>>(url, data, config);
    return response.data.data as T;
  }

  /**
   * DELETE request
   */
  async delete<T>(url: string, config?: InternalAxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<ApiResponse<T>>(url, config);
    return response.data.data as T;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();

