'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { useAuth } from '@/contexts/AuthContext';
import type { ReactNode } from 'react';

export default function CustomerAuthWrapper({ children }: { children: ReactNode }) {
  // Redirects to login if not authenticated
  useRequireAuth();

  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div>
      {/* Header is global in root layout */}
      <main>{children}</main>
    </div>
  );
}

