// API Base URL - uses environment variable
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

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
  // Admin
  ADMIN: {
    PRODUCTS: {
      LIST: '/api/admin/products',
      CREATE: '/api/admin/products',
      UPDATE: (id: string) => `/api/admin/products/${id}`,
      DELETE: (id: string) => `/api/admin/products/${id}`,
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
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'milko_auth_token',
  USER: 'milko_user',
} as const;

