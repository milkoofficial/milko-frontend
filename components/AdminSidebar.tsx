'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { adminOrdersApi } from '@/lib/api';
import styles from './AdminSidebar.module.css';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  description?: string;
}

/**
 * Admin Sidebar Component
 * Sticky left sidebar with navigation menu and icons
 */
export default function AdminSidebar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  const menuItems: MenuItem[] = [
    {
      name: 'Dashboard',
      path: '/admin',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      ),
    },
    {
      name: 'Products',
      path: '/admin/products',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
          <line x1="3" y1="6" x2="21" y2="6"/>
          <path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
      ),
    },
    {
      name: 'Banners',
      path: '/admin/banners',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
      ),
    },
    {
      name: 'Orders',
      path: '/admin/orders',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
          <path d="M9 14l2 2 4-4"/>
        </svg>
      ),
    },
    {
      name: 'Customers',
      path: '/admin/customers',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      name: 'Subscriptions',
      path: '/admin/subscriptions',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          <path d="M12 11v6"/>
          <path d="M9 13l3-3 3 3"/>
        </svg>
      ),
    },
    {
      name: 'Deliveries',
      path: '/admin/deliveries',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 3h15v13H1z"/>
          <path d="M16 8h4l3 3v5h-7V8z"/>
          <circle cx="5.5" cy="18.5" r="2.5"/>
          <circle cx="18.5" cy="18.5" r="2.5"/>
        </svg>
      ),
    },
    {
      name: 'Feedback',
      path: '/admin/feedback',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
      ),
    },
    {
      name: 'More',
      path: '/admin/content',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1"/>
          <circle cx="19" cy="12" r="1"/>
          <circle cx="5" cy="12" r="1"/>
        </svg>
      ),
    },
  ];

  // Fetch pending orders count for badge
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const data = await adminOrdersApi.getPendingCount();
        setPendingOrdersCount(data.count || 0);
      } catch (error) {
        console.error('Failed to fetch pending orders count:', error);
        setPendingOrdersCount(0);
      }
    };

    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  const handleLogout = async () => {
    await logout();
    router.push('/auth/login');
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return pathname === '/admin';
    }
    return pathname?.startsWith(path);
  };

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logoSection}>
        <Link href="/admin" className={styles.logo}>
          <span className={styles.logoIcon}>🥛</span>
          <span className={styles.logoText}>Milko Admin</span>
        </Link>
      </div>

      {/* Navigation Menu */}
      <nav className={styles.nav}>
        {menuItems.map((item) => (
          <Link
            key={item.path}
            href={item.path}
            className={`${styles.navItem} ${isActive(item.path) ? styles.navItemActive : ''}`}
            title={item.description || item.name}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.name}</span>
            {item.path === '/admin/orders' && pendingOrdersCount > 0 && (
              <span className={styles.navBadge}>{pendingOrdersCount}</span>
            )}
          </Link>
        ))}
      </nav>

      {/* User Section */}
      <div className={styles.userSection}>
        <div className={styles.userDropdown} ref={userDropdownRef}>
          <button
            onClick={() => setShowUserDropdown(!showUserDropdown)}
            className={styles.userButton}
          >
            <div className={styles.userAvatar}>
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.name || 'Admin'}</div>
              <div className={styles.userRole}>Administrator</div>
            </div>
            <svg 
              className={`${styles.dropdownArrow} ${showUserDropdown ? styles.dropdownArrowOpen : ''}`} 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M6 9L12 15L18 9"/>
            </svg>
          </button>
          {showUserDropdown && (
            <div className={styles.dropdownMenu}>
              <Link 
                href={typeof window !== 'undefined' && window.location.hostname.includes('localhost') ? '/' : 'https://milko.in'} 
                className={styles.dropdownItem}
                onClick={() => setShowUserDropdown(false)}
                target={typeof window !== 'undefined' && window.location.hostname.includes('localhost') ? undefined : '_blank'} 
                rel="noopener noreferrer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                <span>View Site</span>
              </Link>
              <button 
                className={styles.dropdownItem}
                onClick={() => {
                  setShowUserDropdown(false);
                  handleLogout();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
