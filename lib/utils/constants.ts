// API Base URL - uses environment variable
// Production: https://milko-backend.onrender.com
// Development: http://localhost:3001
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://milko-backend.onrender.com';

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/api/auth/login',
    SIGNUP: '/api/auth/signup',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    REFRESH: '/api/auth/refresh',
  },
  // Products
  PRODUCTS: {
    LIST: '/api/products',
    DETAIL: (id: string) => `/api/products/${id}`,
  },
  // Subscriptions
  SUBSCRIPTIONS: {
    LIST: '/api/subscriptions',
    CREATE: '/api/subscriptions',
    DETAIL: (id: string) => `/api/subscriptions/${id}`,
    PAUSE: (id: string) => `/api/subscriptions/${id}/pause`,
    RESUME: (id: string) => `/api/subscriptions/${id}/resume`,
    CANCEL: (id: string) => `/api/subscriptions/${id}/cancel`,
    PAUSE_DATE: (id: string) => `/api/subscriptions/${id}/pause-date`,
  },
  // Banners
  BANNERS: {
    LIST: '/api/banners',
  },
  // Content
  CONTENT: {
    GET: (type: string) => `/api/content/${type}`,
  },
  // Admin
  ADMIN: {
    PRODUCTS: {
      LIST: '/api/admin/products',
      CREATE: '/api/admin/products',
      DETAIL: (id: string) => `/api/admin/products/${id}`,
      UPDATE: (id: string) => `/api/admin/products/${id}`,
      DELETE: (id: string) => `/api/admin/products/${id}`,
      ADD_IMAGE: (id: string) => `/api/admin/products/${id}/images`,
      DELETE_IMAGE: (id: string, imageId: string) => `/api/admin/products/${id}/images/${imageId}`,
      ADD_VARIATION: (id: string) => `/api/admin/products/${id}/variations`,
      UPDATE_VARIATION: (id: string, variationId: string) => `/api/admin/products/${id}/variations/${variationId}`,
      DELETE_VARIATION: (id: string, variationId: string) => `/api/admin/products/${id}/variations/${variationId}`,
      ADD_REVIEW: (id: string) => `/api/admin/products/${id}/reviews`,
      UPDATE_REVIEW: (id: string, reviewId: string) => `/api/admin/products/${id}/reviews/${reviewId}`,
      DELETE_REVIEW: (id: string, reviewId: string) => `/api/admin/products/${id}/reviews/${reviewId}`,
    },
    USERS: {
      LIST: '/api/admin/users',
      DETAIL: (id: string) => `/api/admin/users/${id}`,
    },
    SUBSCRIPTIONS: {
      LIST: '/api/admin/subscriptions',
      DETAIL: (id: string) => `/api/admin/subscriptions/${id}`,
      PAUSE: (id: string) => `/api/admin/subscriptions/${id}/pause`,
      RESUME: (id: string) => `/api/admin/subscriptions/${id}/resume`,
    },
    DELIVERIES: {
      LIST: '/api/admin/deliveries',
      UPDATE_STATUS: (id: string) => `/api/admin/deliveries/${id}`,
    },
    BANNERS: {
      LIST: '/api/admin/banners',
      CREATE: '/api/admin/banners',
      UPDATE: (id: string) => `/api/admin/banners/${id}`,
      DELETE: (id: string) => `/api/admin/banners/${id}`,
    },
    CONTENT: {
      LIST: '/api/admin/content',
      GET: (type: string) => `/api/admin/content/${type}`,
      UPDATE: (type: string) => `/api/admin/content/${type}`,
      TOGGLE_STATUS: (type: string) => `/api/admin/content/${type}/status`,
    },
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'milko_auth_token',
  USER: 'milko_user',
} as const;

