'use client';

import { usePathname } from 'next/navigation';
import Header from './Header';
import AdminHeader from './AdminHeader';

/**
 * Conditional Header Component
 * Shows AdminHeader for /admin routes, regular Header for everything else
 */
export default function ConditionalHeader() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');

  if (isAdminRoute) {
    return <AdminHeader />;
  }

  return <Header />;
}
