import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';

export interface SiteContent {
  id: number;
  contentType: string;
  title: string;
  content: string;
  metadata: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Public Content API
 * For fetching content to display on frontend
 */
export const contentApi = {
  /**
   * Get content by type (public)
   */
  getByType: async (type: string): Promise<SiteContent> => {
    return apiClient.get<SiteContent>(API_ENDPOINTS.CONTENT.GET(type));
  },
};

/**
 * Admin Content API
 * For managing content in admin panel
 */
export const adminContentApi = {
  /**
   * Get all content (admin)
   */
  getAll: async (): Promise<SiteContent[]> => {
    return apiClient.get<SiteContent[]>(API_ENDPOINTS.ADMIN.CONTENT.LIST);
  },

  /**
   * Get content by type (admin)
   */
  getByType: async (type: string): Promise<SiteContent> => {
    return apiClient.get<SiteContent>(API_ENDPOINTS.ADMIN.CONTENT.GET(type));
  },

  /**
   * Update content (admin)
   */
  update: async (
    type: string,
    data: { title: string; content: string; metadata?: Record<string, any> }
  ): Promise<SiteContent> => {
    return apiClient.put<SiteContent>(API_ENDPOINTS.ADMIN.CONTENT.UPDATE(type), data);
  },

  /**
   * Toggle content status (admin)
   */
  toggleStatus: async (type: string, isActive: boolean): Promise<SiteContent> => {
    return apiClient.patch<SiteContent>(API_ENDPOINTS.ADMIN.CONTENT.TOGGLE_STATUS(type), {
      isActive,
    });
  },

  /**
   * Upload or update logo (image to Cloudinary, width in metadata)
   * FormData: 'image' (file, optional), 'widthPx' (number, optional)
   */
  uploadLogo: async (formData: FormData): Promise<SiteContent> => {
    const instance = apiClient.getInstance();
    const res = await instance.post<{ success: boolean; data: SiteContent }>(
      API_ENDPOINTS.ADMIN.LOGO.UPLOAD,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data.data;
  },
};
