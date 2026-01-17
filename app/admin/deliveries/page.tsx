'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { DeliverySchedule } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';

/**
 * Admin Deliveries Page
 * View and manage daily delivery schedules
 */
export default function AdminDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliverySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'skipped' | 'cancelled'>('all');
  const [sort, setSort] = useState<'dateDesc' | 'dateAsc' | 'statusAsc'>('dateDesc');
  const { showToast } = useToast();

  useEffect(() => {
    fetchDeliveries();
  }, [selectedDate]);

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<DeliverySchedule[]>(
        `${API_ENDPOINTS.ADMIN.DELIVERIES.LIST}?date=${selectedDate}`
      );
      setDeliveries(data);
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
      showToast('Failed to load deliveries', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...deliveries];

    // Search filter
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (delivery) =>
          delivery.subscriptionId.toString().includes(q) ||
          (delivery.subscription?.product?.name || '').toLowerCase().includes(q) ||
          (delivery.subscription?.user?.name || '').toLowerCase().includes(q) ||
          (delivery.subscription?.user?.email || '').toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((delivery) => {
        if (statusFilter === 'pending') return delivery.status === 'pending';
        if (statusFilter === 'delivered') return delivery.status === 'delivered';
        if (statusFilter === 'skipped') return delivery.status === 'skipped';
        if (statusFilter === 'cancelled') return delivery.status === 'cancelled';
        return true;
      });
    }

    // Sort
    result.sort((a, b) => {
      if (sort === 'dateAsc') {
        return new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime();
      }
      if (sort === 'statusAsc') {
        return a.status.localeCompare(b.status);
      }
      // dateDesc
      return new Date(b.deliveryDate).getTime() - new Date(a.deliveryDate).getTime();
    });

    return result;
  }, [deliveries, query, statusFilter, sort]);

  const handleMarkDelivered = async (id: string) => {
    try {
      // TODO: Implement mark as delivered API call
      showToast('Delivery marked as delivered', 'success');
      await fetchDeliveries();
    } catch (error) {
      console.error('Failed to mark delivery as delivered:', error);
      showToast('Failed to update delivery status', 'error');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'delivered':
        return styles.badgeDelivered;
      case 'pending':
        return styles.badgePending;
      case 'skipped':
        return styles.badgeSkipped;
      case 'cancelled':
        return styles.badgeCancelled;
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
          <h1 className={adminStyles.adminPageTitle}>Delivery Schedule</h1>
          <p className={styles.subtitle}>View and manage daily delivery schedules</p>
        </div>
      </div>

      <div className={styles.dateFilterRow}>
        <label className={styles.dateLabel}>Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className={styles.dateInput}
        />
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
            placeholder="Search by subscription, product, or customer..."
            className={styles.searchInput}
          />
        </div>

        <CustomSelect<'all' | 'pending' | 'delivered' | 'skipped' | 'cancelled'>
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All Status' },
            { value: 'pending', label: 'Pending' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'skipped', label: 'Skipped' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />

        <CustomSelect<'dateDesc' | 'dateAsc' | 'statusAsc'>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'dateDesc', label: 'Newest First' },
            { value: 'dateAsc', label: 'Oldest First' },
            { value: 'statusAsc', label: 'Status (A-Z)' },
          ]}
        />
      </div>

      <div className={styles.panel}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No deliveries found for {new Date(selectedDate).toLocaleDateString()}</p>
            {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
          </div>
        ) : (
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Subscription</th>
                  <th>Product</th>
                  <th>Customer</th>
                  <th>Delivery Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>
                      <div className={styles.subscriptionCell}>
                        #{delivery.subscriptionId}
                      </div>
                    </td>
                    <td>
                      <div className={styles.productCell}>
                        {delivery.subscription?.product?.name || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div className={styles.customerCell}>
                        <div className={styles.customerName}>
                          {delivery.subscription?.user?.name || delivery.subscription?.user?.email || 'N/A'}
                        </div>
                        {delivery.subscription?.user?.email && delivery.subscription?.user?.name && (
                          <div className={styles.customerEmail}>{delivery.subscription.user.email}</div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className={styles.dateCell}>
                        {new Date(delivery.deliveryDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </td>
                    <td>
                      <span className={`${styles.badge} ${getStatusBadgeClass(delivery.status)}`}>
                        {delivery.status}
                      </span>
                    </td>
                    <td>
                      <div className={styles.actions}>
                        {delivery.status === 'pending' && (
                          <button
                            onClick={() => handleMarkDelivered(delivery.id)}
                            className={styles.actionButton}
                            title="Mark as Delivered"
                          >
                            Mark Delivered
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
