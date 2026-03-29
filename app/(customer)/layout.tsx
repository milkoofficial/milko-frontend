'use client';

import { useRequireAuth } from '@/hooks/useRequireAuth';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

/**
 * Customer Layout
 * Wraps all customer routes with navigation and auth protection
 */
export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  useRequireAuth(); // Redirects to login if not authenticated

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return null; // Will redirect via useRequireAuth
  }

  return (
    <div>
      {/* Header is now global in root layout */}
      <main>
        {children}
      </main>
    </div>
  );
}

