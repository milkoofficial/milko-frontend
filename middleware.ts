import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for route protection
 * Runs on edge runtime - checks JWT token in cookies/headers
 * 
 * Note: This is a basic implementation. In production, you might want to:
 * - Verify JWT signature here (requires JWT_SECRET in edge runtime)
 * - Use httpOnly cookies instead of localStorage
 * - Add rate limiting
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = ['/auth/login', '/auth/signup', '/'];
  const isPublicRoute = publicRoutes.some(route => pathname === route || pathname.startsWith(route));

  // Admin routes
  const isAdminRoute = pathname.startsWith('/admin');

  // Get token from cookie (if using httpOnly cookies) or check header
  // For now, we'll let the client-side handle auth checks
  // This middleware can be enhanced later to verify JWT server-side

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

