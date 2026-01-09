import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for route protection and subdomain routing
 * Handles:
 * - Subdomain detection (admin.milko.in vs milko.in)
 * - Route redirection based on domain
 * - Admin route protection on customer domain
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  
  // Detect if we're on admin subdomain
  const isAdminSubdomain = hostname.startsWith('admin.') || hostname === 'admin.milko.in';
  const isCustomerDomain = !isAdminSubdomain && (hostname === 'milko.in' || hostname.includes('localhost'));

  // Redirect admin routes on customer domain to admin subdomain
  // BUT: In localhost, allow admin routes on same domain
  if (isCustomerDomain && pathname.startsWith('/admin') && !hostname.includes('localhost')) {
    const adminUrl = new URL(request.url);
    adminUrl.hostname = `admin.${hostname.replace('localhost:3000', 'milko.in')}`;
    if (hostname === 'milko.in' || hostname.includes('milko.in')) {
      adminUrl.hostname = 'admin.milko.in';
    }
    return NextResponse.redirect(adminUrl);
  }

  // Redirect customer routes on admin subdomain (except auth)
  // BUT: In localhost, allow all routes on same domain
  if (isAdminSubdomain && !pathname.startsWith('/admin') && !pathname.startsWith('/auth') && !hostname.includes('localhost')) {
    const customerUrl = new URL(request.url);
    customerUrl.hostname = hostname.replace('admin.', '');
    if (hostname === 'admin.milko.in') {
      customerUrl.hostname = 'milko.in';
    }
    return NextResponse.redirect(customerUrl);
  }

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/login', '/auth/signup', '/'];
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

  // Allow public routes
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, we'll rely on client-side auth checks
  // In production, you can verify JWT here and redirect if invalid
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

