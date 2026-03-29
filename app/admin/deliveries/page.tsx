'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { DeliverySchedule } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';

type OrderDeliveryRow = {
  orderId: string;
  orderNumber: string;
  status: 'package_prepared' | 'out_for_delivery' | 'delivered' | string;
  orderedAt: string | null;
  paymentMethod: 'cod' | 'online' | string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded' | 'cod' | string;
  amount: number | null;
  currency: string;
  itemsCount: number;
  packagePreparedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  fulfilledAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
};

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
};

type AdminOrderDetails = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  discount: number;
  deliveryCharges: number;
  total: number;
  deliveryAddress: any;
  createdAt: string | null;
  deliveryDate: string | null;
  packagePreparedAt: string | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  fulfilledAt: string | null;
  customer: { name: string; email: string };
  items: OrderItem[];
};

/**
 * Admin Deliveries Page
 * View and manage daily delivery schedules
 */
export default function AdminDeliveriesPage() {
  const [tab, setTab] = useState<'subscriptions' | 'orders'>('orders');
  const [deliveries, setDeliveries] = useState<DeliverySchedule[]>([]);
  const [orderDeliveries, setOrderDeliveries] = useState<OrderDeliveryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'delivered' | 'skipped' | 'cancelled'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'package_prepared' | 'out_for_delivery' | 'delivered'>('all');
  const [sort, setSort] = useState<'dateDesc' | 'dateAsc' | 'statusAsc'>('dateDesc');
  const { showToast } = useToast();

  useEffect(() => {
    if (tab === 'subscriptions') fetchDeliveries();
  }, [selectedDate, tab]);

  useEffect(() => {
    if (tab === 'orders') fetchOrderDeliveries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  const fetchOrderDeliveries = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<OrderDeliveryRow[]>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.LIST);
      setOrderDeliveries(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch order deliveries:', error);
      showToast('Failed to load order deliveries', 'error');
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
          (delivery.productName || '').toLowerCase().includes(q) ||
          (delivery.userName || '').toLowerCase().includes(q) ||
          (delivery.userEmail || '').toLowerCase().includes(q)
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

  const filteredOrders = useMemo(() => {
    let result = [...orderDeliveries];

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (o) =>
          (o.orderNumber || '').toLowerCase().includes(q) ||
          (o.customerName || '').toLowerCase().includes(q) ||
          (o.customerEmail || '').toLowerCase().includes(q) ||
          (o.status || '').toLowerCase().includes(q)
      );
    }

    if (orderStatusFilter !== 'all') {
      result = result.filter((o) => o.status === orderStatusFilter);
    }

    result.sort((a, b) => {
      const ta = a.orderedAt ? new Date(a.orderedAt).getTime() : 0;
      const tb = b.orderedAt ? new Date(b.orderedAt).getTime() : 0;
      return tb - ta;
    });

    return result;
  }, [orderDeliveries, query, orderStatusFilter]);

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<AdminOrderDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | { kind: 'out' | 'deliver' | 'fulfill' }>(null);

  const openOrderDetails = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailsLoading(true);
    try {
      const data = await apiClient.get<AdminOrderDetails>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.DETAIL(orderId));
      setSelectedOrder(data);
    } catch (error) {
      console.error('Failed to load order details:', error);
      showToast('Failed to load order details', 'error');
      setSelectedOrderId(null);
      setSelectedOrder(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  const runOrderAction = async () => {
    if (!selectedOrder || !confirmAction) return;
    try {
      if (confirmAction.kind === 'out') {
        await apiClient.post(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.MARK_OUT_FOR_DELIVERY(selectedOrder.id));
      } else if (confirmAction.kind === 'deliver') {
        await apiClient.post(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.MARK_DELIVERED(selectedOrder.id));
      } else if (confirmAction.kind === 'fulfill') {
        await apiClient.post(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.MARK_FULFILLED(selectedOrder.id));
      }

      showToast('Updated successfully', 'success');
      setConfirmAction(null);

      // Refresh list + details
      await fetchOrderDeliveries();
      const refreshed = await apiClient.get<AdminOrderDetails>(API_ENDPOINTS.ADMIN.ORDER_DELIVERIES.DETAIL(selectedOrder.id));
      setSelectedOrder(refreshed);
    } catch (error) {
      console.error('Failed to update order:', error);
      showToast('Failed to update order', 'error');
    }
  };

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

  const getOrderStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'package_prepared':
        return styles.badgePrepared;
      case 'out_for_delivery':
        return styles.badgeOutForDelivery;
      case 'delivered':
        return styles.badgeDelivered;
      default:
        return styles.badgeInfo;
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
          <h1 className={adminStyles.adminPageTitle}>Deliveries</h1>
          <p className={styles.subtitle}>Manage subscription deliveries and checkout order deliveries</p>
        </div>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabButton} ${tab === 'orders' ? styles.tabButtonActive : ''}`}
            onClick={() => setTab('orders')}
          >
            Orders
          </button>
          <button
            type="button"
            className={`${styles.tabButton} ${tab === 'subscriptions' ? styles.tabButtonActive : ''}`}
            onClick={() => setTab('subscriptions')}
          >
            Subscriptions
          </button>
        </div>
      </div>

      {tab === 'subscriptions' && (
        <div className={styles.dateFilterRow}>
          <label className={styles.dateLabel}>Select Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>
      )}

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

        {tab === 'subscriptions' ? (
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
        ) : (
          <CustomSelect<'all' | 'package_prepared' | 'out_for_delivery' | 'delivered'>
            value={orderStatusFilter}
            onChange={setOrderStatusFilter}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'package_prepared', label: 'Package Prepared' },
              { value: 'out_for_delivery', label: 'Out for Delivery' },
              { value: 'delivered', label: 'Delivered' },
            ]}
          />
        )}

        {tab === 'subscriptions' ? (
          <CustomSelect<'dateDesc' | 'dateAsc' | 'statusAsc'>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'dateDesc', label: 'Newest First' },
              { value: 'dateAsc', label: 'Oldest First' },
              { value: 'statusAsc', label: 'Status (A-Z)' },
            ]}
          />
        ) : null}
      </div>

      <div className={styles.panel}>
        {tab === 'subscriptions' && filtered.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No deliveries found for {new Date(selectedDate).toLocaleDateString()}</p>
            {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
          </div>
        ) : tab === 'subscriptions' ? (
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
                        {delivery.productName || 'N/A'}
                      </div>
                    </td>
                    <td>
                      <div className={styles.customerCell}>
                        <div className={styles.customerName}>
                          {delivery.userName || delivery.userEmail || 'N/A'}
                        </div>
                        {delivery.userEmail && delivery.userName && (
                          <div className={styles.customerEmail}>{delivery.userEmail}</div>
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
        ) : filteredOrders.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No order deliveries found</p>
            {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
          </div>
        ) : (
          <div className={styles.table}>
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Ordered At</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Items</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => {
                  const isCod = (o.paymentMethod || '').toLowerCase() === 'cod';
                  const codPaid = isCod && (o.paymentStatus || '').toLowerCase() === 'paid';
                  return (
                    <tr
                        key={o.orderId}
                        onClick={() => openOrderDetails(o.orderId)}
                        className={o.status === 'delivered' && o.fulfilledAt ? styles.rowFulfilled : ''}
                        style={{ cursor: 'pointer' }}
                      >
                      <td>
                        <div className={styles.subscriptionCell}>#{o.orderNumber}</div>
                      </td>
                      <td>
                        <div className={styles.customerCell}>
                          <div className={styles.customerName}>{o.customerName || o.customerEmail || '—'}</div>
                          {o.customerEmail && o.customerName && <div className={styles.customerEmail}>{o.customerEmail}</div>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.dateCell}>{o.orderedAt ? new Date(o.orderedAt).toLocaleString() : '—'}</div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${getOrderStatusBadgeClass(o.status)}`}>{o.status}</span>
                      </td>
                      <td>
                        {isCod ? (
                          <div className={styles.paymentBadge}>
                            <span className={`${styles.paymentBadgePill} ${codPaid ? styles.paymentBadgeGreen : styles.paymentBadgeAmber}`}>
                              COD
                            </span>
                            <span className={styles.paymentSubtext}>{codPaid ? 'Paid' : 'Pending'}</span>
                          </div>
                        ) : (
                          <div className={styles.paymentBadge}>
                            <span className={`${styles.paymentBadgePill} ${styles.paymentBadgeGreen}`}>ONLINE</span>
                            <span className={styles.paymentSubtext}>{(o.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : o.paymentStatus}</span>
                          </div>
                        )}
                      </td>
                      <td>{o.itemsCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order details modal */}
      {selectedOrderId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'auto', position: 'relative' }}>
            <button
              type="button"
              onClick={() => { setSelectedOrderId(null); setSelectedOrder(null); setConfirmAction(null); }}
              style={{ position: 'absolute', top: 12, right: 12, border: 'none', background: 'transparent', fontSize: 22, cursor: 'pointer' }}
              aria-label="Close"
            >
              ×
            </button>

            {detailsLoading ? (
              <div style={{ padding: '2.5rem', textAlign: 'center' }}>
                <LoadingSpinner />
              </div>
            ) : selectedOrder ? (
              <div style={{ padding: '1.75rem' }}>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginBottom: 4 }}>Order #{selectedOrder.orderNumber}</h2>
                <div style={{ color: '#64748b', marginBottom: '1.25rem' }}>
                  {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : ''}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Customer</div>
                    <div style={{ fontWeight: 700 }}>{selectedOrder.customer.name || '—'}</div>
                    <div style={{ color: '#64748b' }}>{selectedOrder.customer.email || ''}</div>
                  </div>
                  <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem' }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>Delivery Address</div>
                    {selectedOrder.deliveryAddress ? (
                      <div style={{ color: '#0f172a' }}>
                        <div>{selectedOrder.deliveryAddress.name || ''}</div>
                        <div>{selectedOrder.deliveryAddress.street || ''}</div>
                        <div>
                          {[selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.state, selectedOrder.deliveryAddress.postalCode].filter(Boolean).join(', ')}
                        </div>
                        {selectedOrder.deliveryAddress.phone ? <div>Phone: {selectedOrder.deliveryAddress.phone}</div> : null}
                      </div>
                    ) : (
                      <div style={{ color: '#64748b' }}>—</div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontWeight: 800, marginBottom: 10 }}>Items ({selectedOrder.items.length})</div>
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '0.75rem', border: '1px solid #e5e7eb', background: '#fff', borderRadius: 12, marginBottom: 8 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 10, background: '#e5e7eb', overflow: 'hidden', flexShrink: 0 }}>
                        {it.imageUrl ? <img src={it.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800 }}>{it.productName}</div>
                        <div style={{ color: '#64748b', fontSize: 13 }}>Qty: {it.quantity}{it.variationSize ? ` • ${it.variationSize}` : ''}</div>
                      </div>
                      <div style={{ fontWeight: 900 }}>₹{it.lineTotal.toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18 }}>
                  {selectedOrder.status === 'package_prepared' && (
                    <button
                      type="button"
                      onClick={() => setConfirmAction({ kind: 'out' })}
                      style={{ padding: '0.85rem 1.1rem', borderRadius: 10, border: 'none', background: '#0ea5e9', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                    >
                      Out for delivery
                    </button>
                  )}

                  {selectedOrder.status === 'out_for_delivery' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ kind: 'deliver' })}
                        style={{ padding: '0.85rem 1.1rem', borderRadius: 10, border: 'none', background: '#16a34a', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
                      >
                        Mark as deliver
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ kind: 'fulfill' })}
                        style={{ padding: '0.85rem 1.1rem', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#0f172a', fontWeight: 900, cursor: 'pointer' }}
                      >
                        Mark as fulfilled
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'delivered' &&
                    (selectedOrder.paymentMethod || '').toLowerCase() === 'cod' &&
                    (selectedOrder.paymentStatus || '').toLowerCase() !== 'paid' && (
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ kind: 'fulfill' })}
                        style={{ padding: '0.85rem 1.1rem', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', color: '#0f172a', fontWeight: 900, cursor: 'pointer' }}
                      >
                        Mark as fulfilled
                      </button>
                    )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Confirm action modal */}
      {confirmAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 420, padding: '1.5rem' }}>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>Confirm</div>
            <div style={{ color: '#475569', marginBottom: 16 }}>
              {confirmAction.kind === 'out' && 'Mark this order as out for delivery?'}
              {confirmAction.kind === 'deliver' && 'Mark this order as delivered?'}
              {confirmAction.kind === 'fulfill' && 'Mark this order as fulfilled? (COD will be set to Paid)'}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 900, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runOrderAction}
                style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: 10, border: 'none', background: '#0f172a', color: '#fff', fontWeight: 900, cursor: 'pointer' }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
