'use client';

import { useRequireAdmin } from '@/hooks/useRequireAuth';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';

/**
 * Admin Layout
 * Wraps all admin routes with admin navigation and protection
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin, isAuthenticated, loading, user, logout } = useAuth();
  const router = useRouter();
  useRequireAdmin(); // Redirects if not admin

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        background: '#f5f5f5'
      }}>
        <LoadingSpinnerWithText text="Loading..." />
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Will redirect via useRequireAdmin
  }

  return (
    <div>
      {/* AdminHeader is now in root layout via ConditionalHeader */}
      <main style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 60px)', paddingTop: '60px' }}>{children}</main>
    </div>
  );
}

