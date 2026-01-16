'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

/**
 * Conditional Footer Component
 * Hides footer on auth pages and admin panel
 */
export default function ConditionalFooter() {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth');
  const isAdminRoute = pathname?.startsWith('/admin');

  if (isAuthRoute || isAdminRoute) {
    return null;
  }

  return <Footer />;
}
