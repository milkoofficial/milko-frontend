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
  // Use environment variable if set, otherwise use Render backend URL
  // Development: Can override with http://localhost:3001
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'https://milko-backend.onrender.com';
};

/**
 * Get the appropriate redirect path after login based on domain and role
 */
export const getPostLoginRedirect = (role: 'admin' | 'customer' | string): string => {
  const hostname = getHostname();
  const isLocalhost = hostname === 'localhost' || hostname.includes('localhost');
  
  // Normalize role to lowercase for comparison
  const normalizedRole = role?.toLowerCase() || 'customer';
  
  if (isAdminDomain()) {
    return '/admin';
  }
  
  if (normalizedRole === 'admin' && !isAdminDomain()) {
    // Admin logged in on customer domain
    if (isLocalhost) {
      // In development, just redirect to /admin on same domain
      return '/admin';
    }
    // In production, redirect to admin subdomain
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



