/**
 * Domain Detection Utilities
 * Detects if we're on admin.milko.in or milko.in
 */

/**
 * Get the current hostname
 */
export const getHostname = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.hostname;
  }
  return '';
};

/**
 * Check if we're on the admin subdomain
 */
export const isAdminDomain = (): boolean => {
  const hostname = getHostname();
  return hostname.startsWith('admin.') || hostname === 'admin.milko.in';
};

/**
 * Check if we're on the customer domain
 */
export const isCustomerDomain = (): boolean => {
  const hostname = getHostname();
  return !isAdminDomain() && (hostname === 'milko.in' || hostname === 'localhost' || hostname.includes('localhost'));
};

/**
 * Get the base URL for API calls based on domain
 */
export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // In production, API will be on the same domain or a separate API subdomain
    // For now, use environment variable or default
    return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.milko.in';
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
};

/**
 * Get the appropriate redirect path after login based on domain and role
 */
export const getPostLoginRedirect = (role: 'admin' | 'customer'): string => {
  if (isAdminDomain()) {
    return '/admin';
  }
  
  if (role === 'admin' && !isAdminDomain()) {
    // Admin logged in on customer domain - redirect to admin domain
    return 'https://admin.milko.in/admin';
  }
  
  return '/dashboard';
};

/**
 * Get the appropriate redirect path for logout
 */
export const getPostLogoutRedirect = (): string => {
  if (isAdminDomain()) {
    return '/auth/login';
  }
  return '/auth/login';
};

