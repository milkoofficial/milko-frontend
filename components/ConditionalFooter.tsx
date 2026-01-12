'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

/**
 * Conditional Footer Component
 * Hides footer on auth pages
 */
export default function ConditionalFooter() {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/auth');

  if (isAuthRoute) {
    return null;
  }

  return <Footer />;
}
