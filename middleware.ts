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
  if (isCustomerDomain && pathname.startsWith('/admin')) {
    const adminUrl = new URL(request.url);
    adminUrl.hostname = `admin.${hostname.replace('localhost:3000', 'milko.in')}`;
    if (hostname.includes('localhost')) {
      adminUrl.hostname = 'admin.milko.in';
    }
    return NextResponse.redirect(adminUrl);
  }

  // Redirect customer routes on admin subdomain (except auth)
  if (isAdminSubdomain && !pathname.startsWith('/admin') && !pathname.startsWith('/auth')) {
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

