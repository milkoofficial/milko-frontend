// API Base URL - uses environment variable
// Production: https://milko-backend.onrender.com
// Development: http://localhost:3001 (backend default port)
function getApiBaseUrl(): string {
  // First, check environment variable
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }
  
  // Auto-detect local dev in browser
  // - If running on localhost, use localhost backend port (3001)
  // - If running on LAN IP/hostname (e.g. testing on phone), use same host with backend port
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3001';
    // If you're accessing the frontend via LAN (e.g. http://192.168.x.x:3002),
    // "localhost" would point to the phone itself — so use the same host for backend.
    if (host) return `http://${host}:3001`;
  }
  
  // Default to production
  return 'https://milko-backend.onrender.com';
}

export const API_BASE_URL = getApiBaseUrl();

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    LOGIN: '/api/auth/login',
    SIGNUP: '/api/auth/signup',
    LOGOUT: '/api/auth/logout',
    ME: '/api/auth/me',
    REFRESH: '/api/auth/refresh',
    EXCHANGE_TOKEN: '/api/auth/exchange-token',
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
  // Coupons
  COUPONS: {
    VALIDATE: '/api/coupons/validate',
  },
  // Addresses
  ADDRESSES: {
    LIST: '/api/addresses',
    CREATE: '/api/addresses',
    DETAIL: (id: string) => `/api/addresses/${id}`,
    UPDATE: (id: string) => `/api/addresses/${id}`,
    DELETE: (id: string) => `/api/addresses/${id}`,
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
    ORDERS: {
      LIST: '/api/admin/orders',
      PENDING_COUNT: '/api/admin/orders/pending-count',
      MARK_PACKAGE_PREPARED: (id: string) => `/api/admin/orders/${id}/mark-package-prepared`,
      MARK_OUT_FOR_DELIVERY: (id: string) => `/api/admin/orders/${id}/mark-out-for-delivery`,
      MARK_DELIVERED: (id: string) => `/api/admin/orders/${id}/mark-delivered`,
      MARK_FULFILLED: (id: string) => `/api/admin/orders/${id}/mark-fulfilled`,
      DETAIL: (id: string) => `/api/admin/orders/${id}`,
    },
    ORDER_DELIVERIES: {
      LIST: '/api/admin/order-deliveries',
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
    LOGO: {
      UPLOAD: '/api/admin/logo',
    },
    COUPONS: {
      LIST: '/api/admin/coupons',
      CREATE: '/api/admin/coupons',
      DETAIL: (id: string) => `/api/admin/coupons/${id}`,
      UPDATE: (id: string) => `/api/admin/coupons/${id}`,
      DELETE: (id: string) => `/api/admin/coupons/${id}`,
    },
  },
} as const;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'milko_auth_token',
  USER: 'milko_user',
} as const;

