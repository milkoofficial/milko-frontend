'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import styles from './AdminTopBar.module.css';

interface MenuItem {
  name: string;
  path: string;
  description: string;
}

/**
 * Admin Top Bar Component
 * Top bar with search functionality for admin panel
 */
export default function AdminTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Admin menu items for search
  const adminMenuItems: MenuItem[] = [
    { name: 'Dashboard', path: '/admin', description: 'Admin dashboard' },
    { name: 'Products', path: '/admin/products', description: 'Manage products' },
    { name: 'Banners', path: '/admin/banners', description: 'Manage banners' },
    { name: 'Orders', path: '/admin/customers', description: 'View orders' },
    { name: 'Subscriptions', path: '/admin/subscriptions', description: 'Manage subscriptions' },
    { name: 'Deliveries', path: '/admin/deliveries', description: 'Delivery schedule' },
    { name: 'More', path: '/admin/content', description: 'Manage site content' },
    { name: 'Categories', path: '/admin/categories', description: 'Manage product categories' },
  ];

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };

    if (showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSearchResults]);

  // Filter menu items based on search
  useEffect(() => {
    if (searchQuery.trim()) {
      setShowSearchResults(true);
    } else {
      setShowSearchResults(false);
    }
  }, [searchQuery]);

  const navigateToResult = (path: string) => {
    router.push(path);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && adminMenuItems.length > 0) {
      navigateToResult(adminMenuItems[0].path);
    }
  };

  return (
    <div className={styles.topBar}>
      <div className={styles.topBarContent}>
        {/* Search Bar */}
        <div className={styles.searchContainer} ref={searchRef}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <div className={styles.searchIcon}>
              <svg 
                width="26"
                height="26"
                viewBox="0 -0.5 25 25" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  fillRule="evenodd" 
                  clipRule="evenodd" 
                  d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
                <path 
                  d="M15.989 15.4905L19.5 19.0015" 
                  stroke="currentColor" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search admin items (products, banners, customers...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setShowSearchResults(false);
                }}
                className={styles.clearSearchButton}
                aria-label="Clear search"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </form>

          {/* Search Results Dropdown */}
          {showSearchResults && searchQuery.trim() && (
            <div className={styles.searchResults}>
              {adminMenuItems
                .filter(item =>
                  item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  item.description.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((item) => (
                  <button
                    key={item.path}
                    className={styles.searchResultItem}
                    onClick={() => navigateToResult(item.path)}
                  >
                    <div className={styles.searchResultName}>{item.name}</div>
                    <div className={styles.searchResultDesc}>{item.description}</div>
                  </button>
                ))}
              {adminMenuItems.filter(item =>
                item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.description.toLowerCase().includes(searchQuery.toLowerCase())
              ).length === 0 && (
                <div className={styles.noResults}>No results found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
