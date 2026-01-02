import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { Product, PaginatedResponse } from '@/types';

/**
 * Products API Service
 */
export const productsApi = {
  /**
   * Get all active products (customer view)
   */
  getAll: async (): Promise<Product[]> => {
    return apiClient.get<Product[]>(API_ENDPOINTS.PRODUCTS.LIST);
  },

  /**
   * Get product by ID
   */
  getById: async (id: string): Promise<Product> => {
    return apiClient.get<Product>(API_ENDPOINTS.PRODUCTS.DETAIL(id));
  },
};

/**
 * Admin Products API Service
 */
export const adminProductsApi = {
  /**
   * Get all products (admin view - includes inactive)
   */
  getAll: async (): Promise<Product[]> => {
    return apiClient.get<Product[]>(API_ENDPOINTS.ADMIN.PRODUCTS.LIST);
  },

  /**
   * Create new product
   */
  create: async (product: {
    name: string;
    description?: string;
    pricePerLitre: number;
    imageUrl?: string;
    isActive: boolean;
  }): Promise<Product> => {
    return apiClient.post<Product>(API_ENDPOINTS.ADMIN.PRODUCTS.CREATE, product);
  },

  /**
   * Update product
   */
  update: async (id: string, product: Partial<Product>): Promise<Product> => {
    return apiClient.put<Product>(API_ENDPOINTS.ADMIN.PRODUCTS.UPDATE(id), product);
  },

  /**
   * Delete product
   */
  delete: async (id: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.ADMIN.PRODUCTS.DELETE(id));
  },
};

