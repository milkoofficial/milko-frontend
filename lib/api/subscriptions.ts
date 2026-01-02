import { apiClient } from './client';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { Subscription, SubscriptionCreateRequest, RazorpayOrder, PausedDate } from '@/types';

/**
 * Subscriptions API Service (Customer)
 */
export const subscriptionsApi = {
  /**
   * Get all subscriptions for current user
   */
  getAll: async (): Promise<Subscription[]> => {
    return apiClient.get<Subscription[]>(API_ENDPOINTS.SUBSCRIPTIONS.LIST);
  },

  /**
   * Get subscription by ID
   */
  getById: async (id: string): Promise<Subscription> => {
    return apiClient.get<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.DETAIL(id));
  },

  /**
   * Create new subscription
   * Returns Razorpay order details for payment
   */
  create: async (data: SubscriptionCreateRequest): Promise<RazorpayOrder> => {
    return apiClient.post<RazorpayOrder>(API_ENDPOINTS.SUBSCRIPTIONS.CREATE, data);
  },

  /**
   * Pause subscription
   */
  pause: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.PAUSE(id));
  },

  /**
   * Resume subscription
   */
  resume: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.RESUME(id));
  },

  /**
   * Cancel subscription
   */
  cancel: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.SUBSCRIPTIONS.CANCEL(id));
  },

  /**
   * Pause a specific delivery date
   */
  pauseDate: async (id: string, date: string): Promise<PausedDate> => {
    return apiClient.post<PausedDate>(API_ENDPOINTS.SUBSCRIPTIONS.PAUSE_DATE(id), { date });
  },
};

/**
 * Admin Subscriptions API Service
 */
export const adminSubscriptionsApi = {
  /**
   * Get all subscriptions (admin view)
   */
  getAll: async (): Promise<Subscription[]> => {
    return apiClient.get<Subscription[]>(API_ENDPOINTS.ADMIN.SUBSCRIPTIONS.LIST);
  },

  /**
   * Get subscription by ID
   */
  getById: async (id: string): Promise<Subscription> => {
    return apiClient.get<Subscription>(API_ENDPOINTS.ADMIN.SUBSCRIPTIONS.DETAIL(id));
  },

  /**
   * Pause subscription (admin)
   */
  pause: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.ADMIN.SUBSCRIPTIONS.PAUSE(id));
  },

  /**
   * Resume subscription (admin)
   */
  resume: async (id: string): Promise<Subscription> => {
    return apiClient.post<Subscription>(API_ENDPOINTS.ADMIN.SUBSCRIPTIONS.RESUME(id));
  },
};

