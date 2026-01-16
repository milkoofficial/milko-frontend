import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { Product, ProductImage, ProductVariation, ProductReview, PaginatedResponse } from '@/types';

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
   * Get product by ID (with details - images, variations, reviews)
   */
  getById: async (id: string, includeDetails = false): Promise<Product> => {
    const url = includeDetails 
      ? `${API_ENDPOINTS.PRODUCTS.DETAIL(id)}?details=true`
      : API_ENDPOINTS.PRODUCTS.DETAIL(id);
    return apiClient.get<Product>(url);
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
   * Get product by ID with all details
   */
  getById: async (id: string): Promise<Product> => {
    return apiClient.get<Product>(API_ENDPOINTS.ADMIN.PRODUCTS.DETAIL(id));
  },

  /**
   * Create new product
   * Accepts FormData for file uploads
   */
  create: async (formData: FormData): Promise<Product> => {
    const instance = apiClient.getInstance();
    const response = await instance.post<{ success: boolean; data: Product }>(
      API_ENDPOINTS.ADMIN.PRODUCTS.CREATE,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data.data;
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

  // Product Images
  addImage: async (productId: string, imageFile: File, displayOrder = 0): Promise<ProductImage> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('displayOrder', displayOrder.toString());
    const instance = apiClient.getInstance();
    const response = await instance.post<{ success: boolean; data: ProductImage }>(
      API_ENDPOINTS.ADMIN.PRODUCTS.ADD_IMAGE(productId),
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    );
    return response.data.data;
  },

  deleteImage: async (productId: string, imageId: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.ADMIN.PRODUCTS.DELETE_IMAGE(productId, imageId));
  },

  // Product Variations
  addVariation: async (productId: string, variation: {
    size: string;
    priceMultiplier?: number;
    price?: number;
    isAvailable?: boolean;
    displayOrder?: number;
  }): Promise<ProductVariation> => {
    return apiClient.post<ProductVariation>(API_ENDPOINTS.ADMIN.PRODUCTS.ADD_VARIATION(productId), variation);
  },

  updateVariation: async (productId: string, variationId: string, updates: Partial<ProductVariation>): Promise<ProductVariation> => {
    return apiClient.put<ProductVariation>(API_ENDPOINTS.ADMIN.PRODUCTS.UPDATE_VARIATION(productId, variationId), updates);
  },

  deleteVariation: async (productId: string, variationId: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.ADMIN.PRODUCTS.DELETE_VARIATION(productId, variationId));
  },

  // Product Reviews
  addReview: async (productId: string, review: {
    reviewerName: string;
    rating: number;
    comment?: string;
    isApproved?: boolean;
  }): Promise<ProductReview> => {
    return apiClient.post<ProductReview>(API_ENDPOINTS.ADMIN.PRODUCTS.ADD_REVIEW(productId), review);
  },

  updateReview: async (productId: string, reviewId: string, updates: Partial<ProductReview>): Promise<ProductReview> => {
    return apiClient.put<ProductReview>(API_ENDPOINTS.ADMIN.PRODUCTS.UPDATE_REVIEW(productId, reviewId), updates);
  },

  deleteReview: async (productId: string, reviewId: string): Promise<void> => {
    return apiClient.delete<void>(API_ENDPOINTS.ADMIN.PRODUCTS.DELETE_REVIEW(productId, reviewId));
  },
};

