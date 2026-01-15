'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Header from './Header';
import AdminHeader from './AdminHeader';

/**
 * Conditional Header Component
 * Shows AdminHeader for /admin routes, regular Header for everything else
 * Hides AdminHeader when admin panel password is not verified
 */
export default function ConditionalHeader() {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith('/admin');
  const [isPasswordVerified, setIsPasswordVerified] = useState(true);

  useEffect(() => {
    if (isAdminRoute && typeof window !== 'undefined') {
      const verified = sessionStorage.getItem('adminPanelVerified') === 'true';
      setIsPasswordVerified(verified);
    }
  }, [isAdminRoute]);

  if (isAdminRoute) {
    // Don't show admin header if password is not verified
    if (!isPasswordVerified) {
      return null;
    }
    return <AdminHeader />;
  }

  return <Header />;
}
