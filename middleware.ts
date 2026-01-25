import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { COMING_SOON_BYPASS_COOKIE, MILKO_ADMIN_COOKIE } from '@/lib/utils/constants';

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'https://milko-backend.onrender.com';

/**
 * Middleware for route protection and subdomain routing
 * Handles:
 * - Coming Soon mode: redirect customers to /coming-soon unless bypass cookie or /admin, /auth
 * - Subdomain detection (admin.milko.in vs milko.in)
 * - Admin route protection (client-side verifies role)
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  const isAdminSubdomain =
    hostname.startsWith('admin.') || hostname === 'admin.milko.in';
  const isCustomerDomain =
    !isAdminSubdomain && (hostname === 'milko.in' || hostname.includes('localhost'));

  // Always allow these paths (admin, auth, coming-soon page itself)
  const alwaysAllowed = ['/admin', '/auth', '/coming-soon'];
  const isAlwaysAllowed = alwaysAllowed.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );
  if (isAlwaysAllowed) {
    return NextResponse.next();
  }

  // Check Coming Soon mode: fetch status from backend
  let comingSoonEnabled = false;
  try {
    const res = await fetch(`${API_BASE}/api/content/coming_soon`, {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const json = await res.json();
      comingSoonEnabled =
        !!json?.data?.enabled || !!json?.data?.isActive;
    }
  } catch {
    // On fetch error, assume disabled – don't block the site
  }

  if (!comingSoonEnabled) {
    return NextResponse.next();
  }

  // Coming soon is ON: allow if bypass cookie (access through password) OR logged-in admin cookie
  const bypass = request.cookies.get(COMING_SOON_BYPASS_COOKIE);
  const adminAccess = request.cookies.get(MILKO_ADMIN_COOKIE);
  if (bypass?.value || adminAccess?.value) {
    return NextResponse.next();
  }

  // Redirect to coming-soon (customers: logged out or logged in)
  const url = request.nextUrl.clone();
  url.pathname = '/coming-soon';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
