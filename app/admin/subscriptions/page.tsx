'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { adminSubscriptionsApi } from '@/lib/api';
import { Subscription } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';

/**
 * Admin Subscriptions Page
 * View and manage all subscriptions
 */
export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'cancelled' | 'expired'>('all');
  const [sort, setSort] = useState<'createdDesc' | 'productAsc' | 'customerAsc'>('createdDesc');
  const { showToast } = useToast();

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      const data = await adminSubscriptionsApi.getAll();
      setSubscriptions(data);
    } catch (error) {
      console.error('Failed to fetch subscriptions:', error);
      showToast('Failed to load subscriptions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...subscriptions];

    // Search filter
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (sub) =>
          (sub.product?.name || '').toLowerCase().includes(q) ||
          sub.userId.toString().includes(q) ||
          (sub.userName || '').toLowerCase().includes(q) ||
          (sub.userEmail || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((sub) => sub.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sort === 'productAsc') {
        const aName = (a.product?.name || '').toLowerCase();
        const bName = (b.product?.name || '').toLowerCase();
        return aName.localeCompare(bName);
      }
      if (sort === 'customerAsc') {
        const aName = (a.userName || a.userEmail || '').toLowerCase();
        const bName = (b.userName || b.userEmail || '').toLowerCase();
        return aName.localeCompare(bName);
      }
      // createdDesc
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return result;
  }, [subscriptions, query, statusFilter, sort]);

  const handlePause = async (id: string) => {
    try {
      await adminSubscriptionsApi.pause(id);
      showToast('Subscription paused successfully', 'success');
      await fetchSubscriptions();
    } catch (error) {
      console.error('Failed to pause subscription:', error);
      showToast('Failed to pause subscription', 'error');
    }
  };

  const handleResume = async (id: string) => {
    try {
      await adminSubscriptionsApi.resume(id);
      showToast('Subscription resumed successfully', 'success');
      await fetchSubscriptions();
    } catch (error) {
      console.error('Failed to resume subscription:', error);
      showToast('Failed to resume subscription', 'error');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return styles.badgeActive;
      case 'paused':
        return styles.badgePaused;
      case 'cancelled':
        return styles.badgeCancelled;
      case 'expired':
        return styles.badgeExpired;
      default:
        return styles.badgePending;
    }
  };

  // Custom Select Component
  function CustomSelect<T extends string>({
    value,
    onChange,
    options,
  }: {
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string }[];
  }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    const selected = options.find((o) => o.value === value) || options[0];

    useEffect(() => {
      const onDocClick = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

    return (
      <div className={styles.selectWrap} ref={ref}>
        <button
          type="button"
          className={styles.selectButton}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className={styles.selectValue}>{selected?.label}</span>
          <span className={styles.selectChevron} aria-hidden="true">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5.5 7.5L10 12l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>

        {open && (
          <div className={styles.dropdown} role="listbox" aria-label="Select option">
            {options.map((opt) => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {isActive ? <span style={{ fontWeight: 700, color: '#004e85', fontSize: '.85rem', background: '#cfe4ff', borderRadius: '5px', padding: '3px 6px' }}>Selected</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={adminStyles.adminPageTitle}>Subscriptions</h1>
          <p className={styles.subtitle}>Manage customer subscriptions and delivery schedules</p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16ZM18 18l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product, customer, or ID..."
            className={styles.searchInput}
          />
        </div>

        <CustomSelect<'all' | 'active' | 'paused' | 'cancelled' | 'expired'>
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'active', label: 'Active' },
            { value: 'paused', label: 'Paused' },
            { value: 'cancelled', label: 'Cancelled' },
            { value: 'expired', label: 'Expired' },
          ]}
        />

        <CustomSelect<'createdDesc' | 'productAsc' | 'customerAsc'>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'createdDesc', label: 'Newest First' },
            { value: 'productAsc', label: 'Product (A-Z)' },
            { value: 'customerAsc', label: 'Customer (A-Z)' },
          ]}
        />
      </div>

      <div className={styles.panel}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No subscriptions found</p>
            {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
          </div>
        ) : (
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Customer</th>
                  <th>Quantity</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((subscription) => (
                  <tr key={subscription.id}>
                    <td>
                      <div className={styles.productCell}>
                        {subscription.product?.name || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div className={styles.customerCell}>
                        <div className={styles.customerName}>
                          {subscription.userName || subscription.userEmail || `User ID: ${subscription.userId}`}
                        </div>
                        {subscription.userEmail && subscription.userName && (
                          <div className={styles.customerEmail}>{subscription.userEmail}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.quantityCell}>
                        {subscription.litresPerDay}L/day
                      </div>
                    </td>
                    <td>
                      <div className={styles.durationCell}>
                        {subscription.durationMonths} month{subscription.durationMonths !== 1 ? 's' : ''}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${getStatusBadgeClass(subscription.status)}`}>
                        {subscription.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {subscription.status === 'active' && (
                          <button
                            onClick={() => handlePause(subscription.id)}
                            className={styles.actionButton}
                            title="Pause Subscription"
                          >
                            Pause
                          </button>
                        )}
                        {subscription.status === 'paused' && (
                          <button
                            onClick={() => handleResume(subscription.id)}
                            className={`${styles.actionButton} ${styles.resumeButton}`}
                            title="Resume Subscription"
                          >
                            Resume
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
