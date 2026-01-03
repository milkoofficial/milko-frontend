'use client';

import { useRequireAdmin } from '@/hooks/useRequireAuth';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

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
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!isAuthenticated || !isAdmin) {
    return null; // Will redirect via useRequireAdmin
  }

  return (
    <div>
      {/* Admin Navigation */}
      <nav style={{ 
        background: '#1a1a1a', 
        padding: '1rem 2rem', 
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <Link href="/admin" style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
            Milko.in Admin
          </Link>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/banners">Banners</Link>
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/subscriptions">Subscriptions</Link>
          <Link href="/admin/deliveries">Deliveries</Link>
          <Link href="https://milko.in" style={{ color: '#aaa' }} target="_blank" rel="noopener noreferrer">View Site</Link>
          <span>Admin: {user?.name}</span>
          <button onClick={handleLogout} style={{ padding: '0.5rem 1rem', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </nav>
      <main style={{ background: '#f5f5f5', minHeight: 'calc(100vh - 60px)' }}>{children}</main>
    </div>
  );
}

