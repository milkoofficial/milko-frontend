'use client';

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { DeliverySchedule } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';
import {
  formatDateDDMMYYYYIST,
  formatDateTimeDDMMYYYYIST,
  formatDateTimeIST,
  formatYyyyMmDdInputAsDDMMYYYY,
} from '@/lib/utils/datetime';
import { normalizeAdminListSearchQuery } from '@/lib/utils/searchQuery';

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

const SUBSCRIPTION_STATUS_OPTIONS = [
  { value: 'all' as const, label: 'All Status' },
  { value: 'pending' as const, label: 'Pending' },
  { value: 'delivered' as const, label: 'Delivered' },
  { value: 'skipped' as const, label: 'Skipped' },
  { value: 'cancelled' as const, label: 'Cancelled' },
];

const ORDER_STATUS_OPTIONS = [
  { value: 'all' as const, label: 'All Status' },
  { value: 'package_prepared' as const, label: 'Package Prepared' },
  { value: 'out_for_delivery' as const, label: 'Out for Delivery' },
  { value: 'delivered' as const, label: 'Delivered' },
];

const SUBSCRIPTION_SORT_OPTIONS = [
  { value: 'dateDesc' as const, label: 'Newest First' },
  { value: 'dateAsc' as const, label: 'Oldest First' },
  { value: 'statusAsc' as const, label: 'Status (A-Z)' },
];

function CopyOrderNumberButton({
  orderNumber,
  showToast,
}: {
  orderNumber: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const text = `#${orderNumber}`;
  const onCopy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      showToast('Order number copied', 'success');
    } catch {
      showToast('Could not copy', 'error');
    }
  };
  return (
    <button
      type="button"
      className={styles.copyOrderBtn}
      aria-label={`Copy order number ${text}`}
      title="Copy order number"
      onClick={onCopy}
    >
      <svg
        className={styles.copyOrderIcon}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M8 4v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7.242a2 2 0 0 0-.602-1.43L16.083 2.598A2 2 0 0 0 14.685 2H10a2 2 0 0 0-2 2z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16 18v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h2"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

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
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filterSheetView, setFilterSheetView] = useState<'menu' | 'listTab' | 'status' | 'sort'>('menu');
  const [filterSheetMounted, setFilterSheetMounted] = useState(false);
  const filterSheetMenuTitleId = useId();
  const { showToast } = useToast();

  useEffect(() => setFilterSheetMounted(true), []);

  useEffect(() => {
    if (!filterSheetOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (filterSheetView !== 'menu') setFilterSheetView('menu');
      else setFilterSheetOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [filterSheetOpen, filterSheetView]);

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

    // Search filter (#123 matches subscription id 123)
    const qSub = normalizeAdminListSearchQuery(query);
    if (qSub) {
      result = result.filter(
        (delivery) =>
          delivery.subscriptionId.toString().includes(qSub) ||
          (delivery.productName || '').toLowerCase().includes(qSub) ||
          (delivery.userName || '').toLowerCase().includes(qSub) ||
          (delivery.userEmail || '').toLowerCase().includes(qSub)
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

    const qOrd = normalizeAdminListSearchQuery(query);
    if (qOrd) {
      result = result.filter(
        (o) =>
          (o.orderNumber || '').toLowerCase().includes(qOrd) ||
          (o.orderId || '').toLowerCase().includes(qOrd) ||
          (o.customerName || '').toLowerCase().includes(qOrd) ||
          (o.customerEmail || '').toLowerCase().includes(qOrd) ||
          (o.status || '').toLowerCase().includes(qOrd)
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

  useEffect(() => {
    if (!filterSheetOpen && !selectedOrderId && !confirmAction) return;

    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscrollY = html.style.overscrollBehaviorY;
    const prevBodyOverscrollY = body.style.overscrollBehaviorY;

    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehaviorY = prevHtmlOverscrollY;
      body.style.overscrollBehaviorY = prevBodyOverscrollY;
    };
  }, [filterSheetOpen, selectedOrderId, confirmAction]);

  const closeFilterSheet = () => {
    setFilterSheetOpen(false);
    setFilterSheetView('menu');
  };

  const listTabLabel = tab === 'orders' ? 'Orders' : 'Subscriptions';
  const statusFilterLabel = useMemo(() => {
    if (tab === 'subscriptions') {
      return SUBSCRIPTION_STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label ?? '';
    }
    return ORDER_STATUS_OPTIONS.find((o) => o.value === orderStatusFilter)?.label ?? '';
  }, [tab, statusFilter, orderStatusFilter]);
  const sortFilterLabel = SUBSCRIPTION_SORT_OPTIONS.find((o) => o.value === sort)?.label ?? '';

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
      <div className={styles.headerBlock}>
        <div className={styles.headerRow}>
          <h1 className={adminStyles.adminPageTitle}>Deliveries</h1>
          <p className={styles.subtitle}>Manage subscription deliveries and checkout order deliveries</p>
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
        <div className={styles.searchSlot}>
          <div className={styles.searchWrap}>
            <span className={styles.searchIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === 'subscriptions'
                  ? 'Search subscription, product, customer…'
                  : 'Search order #, customer…'
              }
              aria-label={tab === 'subscriptions' ? 'Search subscription deliveries' : 'Search order deliveries'}
              className={styles.searchInput}
            />
          </div>
        </div>

        <div className={styles.toolbarDesktopFilters}>
          {tab === 'subscriptions' ? (
            <>
              <CustomSelect
                value={statusFilter}
                onChange={setStatusFilter}
                modalTitle="Status"
                options={SUBSCRIPTION_STATUS_OPTIONS}
              />
              <CustomSelect
                value={sort}
                onChange={setSort}
                modalTitle="Sort"
                options={SUBSCRIPTION_SORT_OPTIONS}
              />
            </>
          ) : (
            <CustomSelect
              value={orderStatusFilter}
              onChange={setOrderStatusFilter}
              modalTitle="Order status"
              options={ORDER_STATUS_OPTIONS}
            />
          )}
        </div>

        <button
          type="button"
          className={styles.toolbarMobileFilterBtn}
          aria-label="Filters"
          aria-haspopup="dialog"
          aria-expanded={filterSheetOpen}
          onClick={() => {
            setFilterSheetView('menu');
            setFilterSheetOpen(true);
          }}
        >
          <svg className={styles.toolbarMobileFilterIcon} viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 6h16M8 12h8M10 18h4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="18" cy="6" r="1.75" fill="currentColor" />
            <circle cx="6" cy="12" r="1.75" fill="currentColor" />
            <circle cx="16" cy="18" r="1.75" fill="currentColor" />
          </svg>
        </button>
      </div>

      {filterSheetMounted && filterSheetOpen
        ? createPortal(
            <div
              className={styles.filterSheetBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) closeFilterSheet();
              }}
            >
              <div
                className={styles.filterSheetPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={filterSheetMenuTitleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={styles.filterSheetGrab} aria-hidden />
                {filterSheetView === 'menu' ? (
                  <>
                    <div className={styles.filterSheetHeader}>
                      <h2 id={filterSheetMenuTitleId} className={styles.filterSheetTitle}>
                        Filters
                      </h2>
                      <button type="button" className={styles.filterSheetClose} aria-label="Close filters" onClick={closeFilterSheet}>
                        ×
                      </button>
                    </div>
                    <div className={styles.filterSheetMenu}>
                      <button
                        type="button"
                        className={styles.filterSheetMenuRow}
                        onClick={() => setFilterSheetView('listTab')}
                      >
                        <span className={styles.filterSheetMenuLabel}>List</span>
                        <span className={styles.filterSheetMenuValue}>{listTabLabel}</span>
                        <span className={styles.filterSheetMenuChevron} aria-hidden>
                          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7.5 5L12.5 10L7.5 15" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      <button type="button" className={styles.filterSheetMenuRow} onClick={() => setFilterSheetView('status')}>
                        <span className={styles.filterSheetMenuLabel}>Status</span>
                        <span className={styles.filterSheetMenuValue}>{statusFilterLabel}</span>
                        <span className={styles.filterSheetMenuChevron} aria-hidden>
                          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M7.5 5L12.5 10L7.5 15" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {tab === 'subscriptions' ? (
                        <button type="button" className={styles.filterSheetMenuRow} onClick={() => setFilterSheetView('sort')}>
                          <span className={styles.filterSheetMenuLabel}>Sort</span>
                          <span className={styles.filterSheetMenuValue}>{sortFilterLabel}</span>
                          <span className={styles.filterSheetMenuChevron} aria-hidden>
                            <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M7.5 5L12.5 10L7.5 15" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </>
                ) : null}

                {filterSheetView === 'listTab' ? (
                  <div className={styles.filterSheetSub}>
                    <div className={styles.filterSheetSubHeader}>
                      <button
                        type="button"
                        className={styles.filterSheetBack}
                        aria-label="Back"
                        onClick={() => setFilterSheetView('menu')}
                      >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <h2 className={styles.filterSheetSubTitle}>List</h2>
                    </div>
                    <div className={styles.filterSheetOptions} role="listbox" aria-label="List type">
                      {(
                        [
                          { value: 'orders' as const, label: 'Orders' },
                          { value: 'subscriptions' as const, label: 'Subscriptions' },
                        ] as const
                      ).map((opt) => {
                        const active = tab === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`${styles.filterSheetOption} ${active ? styles.filterSheetOptionActive : ''}`}
                            onClick={() => {
                              setTab(opt.value);
                              setFilterSheetView('menu');
                            }}
                          >
                            <span>{opt.label}</span>
                            {active ? <span className={styles.filterSheetOptionBadge}>Selected</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {filterSheetView === 'status' ? (
                  <div className={styles.filterSheetSub}>
                    <div className={styles.filterSheetSubHeader}>
                      <button
                        type="button"
                        className={styles.filterSheetBack}
                        aria-label="Back"
                        onClick={() => setFilterSheetView('menu')}
                      >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <h2 className={styles.filterSheetSubTitle}>Status</h2>
                    </div>
                    <div className={styles.filterSheetOptions} role="listbox" aria-label="Status">
                      {(tab === 'subscriptions' ? SUBSCRIPTION_STATUS_OPTIONS : ORDER_STATUS_OPTIONS).map((opt) => {
                        const active =
                          tab === 'subscriptions' ? statusFilter === opt.value : orderStatusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`${styles.filterSheetOption} ${active ? styles.filterSheetOptionActive : ''}`}
                            onClick={() => {
                              if (tab === 'subscriptions') {
                                setStatusFilter(opt.value as typeof statusFilter);
                              } else {
                                setOrderStatusFilter(opt.value as typeof orderStatusFilter);
                              }
                              setFilterSheetView('menu');
                            }}
                          >
                            <span>{opt.label}</span>
                            {active ? <span className={styles.filterSheetOptionBadge}>Selected</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {filterSheetView === 'sort' ? (
                  <div className={styles.filterSheetSub}>
                    <div className={styles.filterSheetSubHeader}>
                      <button
                        type="button"
                        className={styles.filterSheetBack}
                        aria-label="Back"
                        onClick={() => setFilterSheetView('menu')}
                      >
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <h2 className={styles.filterSheetSubTitle}>Sort</h2>
                    </div>
                    <div className={styles.filterSheetOptions} role="listbox" aria-label="Sort">
                      {SUBSCRIPTION_SORT_OPTIONS.map((opt) => {
                        const active = sort === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="option"
                            aria-selected={active}
                            className={`${styles.filterSheetOption} ${active ? styles.filterSheetOptionActive : ''}`}
                            onClick={() => {
                              setSort(opt.value);
                              setFilterSheetView('menu');
                            }}
                          >
                            <span>{opt.label}</span>
                            {active ? <span className={styles.filterSheetOptionBadge}>Selected</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>,
            document.body
          )
        : null}

      {tab === 'subscriptions' && filtered.length === 0 ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}>
            <p>No deliveries found for {formatYyyyMmDdInputAsDDMMYYYY(selectedDate)}</p>
            {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
          </div>
        </div>
      ) : tab === 'subscriptions' ? (
          <>
            <div className={`${styles.panel} ${styles.tableDesktop}`}>
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
                            {formatDateDDMMYYYYIST(delivery.deliveryDate)}
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
            </div>
            <div className={styles.cards}>
              {filtered.map((delivery) => (
                <div key={`m-${delivery.id}`} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.cardTitleRow}>
                        <span className={styles.cardTitle}>#{delivery.subscriptionId}</span>
                        <span className={`${styles.badge} ${getStatusBadgeClass(delivery.status)}`}>{delivery.status}</span>
                      </div>
                      <div className={styles.cardProduct}>{delivery.productName || 'N/A'}</div>
                    </div>
                  </div>
                  <div className={styles.cardBody}>
                    <div className={styles.customerCell}>
                      <div className={styles.customerName}>{delivery.userName || delivery.userEmail || 'N/A'}</div>
                      {delivery.userEmail && delivery.userName ? (
                        <div className={styles.customerEmail}>{delivery.userEmail}</div>
                      ) : null}
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardMetaLabel}>Delivery</span>
                      <span className={styles.dateCell}>{formatDateDDMMYYYYIST(delivery.deliveryDate)}</span>
                    </div>
                    {delivery.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleMarkDelivered(delivery.id)}
                        className={styles.actionButton}
                        title="Mark as Delivered"
                      >
                        Mark Delivered
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
      ) : filteredOrders.length === 0 ? (
        <div className={styles.panel}>
          <div className={styles.emptyState}>
            <p>No order deliveries found</p>
            {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
          </div>
        </div>
      ) : (
          <>
            <div className={`${styles.panel} ${styles.tableDesktop}`}>
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
                            <span className={styles.orderNumRow}>
                              <span className={styles.orderNum}>#{o.orderNumber}</span>
                              <CopyOrderNumberButton orderNumber={o.orderNumber} showToast={showToast} />
                            </span>
                          </td>
                          <td>
                            <div className={styles.customerCell}>
                              <div className={styles.customerName}>{o.customerName || o.customerEmail || '—'}</div>
                              {o.customerEmail && o.customerName && <div className={styles.customerEmail}>{o.customerEmail}</div>}
                            </div>
                          </td>
                          <td>
                            <div className={styles.dateCell}>{formatDateTimeDDMMYYYYIST(o.orderedAt)}</div>
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
                                <span className={styles.paymentSubtext}>
                                  {(o.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : o.paymentStatus}
                                </span>
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
            </div>
            <div className={styles.cards}>
              {filteredOrders.map((o) => {
                const isCod = (o.paymentMethod || '').toLowerCase() === 'cod';
                const codPaid = isCod && (o.paymentStatus || '').toLowerCase() === 'paid';
                const fulfilled = o.status === 'delivered' && o.fulfilledAt;
                return (
                  <div
                    key={`m-${o.orderId}`}
                    role="button"
                    tabIndex={0}
                    className={`${styles.card} ${styles.cardClickable} ${fulfilled ? styles.cardFulfilled : ''}`}
                    onClick={() => openOrderDetails(o.orderId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openOrderDetails(o.orderId);
                      }
                    }}
                    aria-label={`Open order ${o.orderNumber}`}
                  >
                    <div className={styles.cardTop}>
                      <div>
                        <div className={styles.cardTitleRow}>
                          <span className={styles.cardTitle}>#{o.orderNumber}</span>
                          <CopyOrderNumberButton orderNumber={o.orderNumber} showToast={showToast} />
                        </div>
                        <div className={styles.cardDate}>{formatDateTimeDDMMYYYYIST(o.orderedAt)}</div>
                      </div>
                      <span className={`${styles.badge} ${getOrderStatusBadgeClass(o.status)}`}>{o.status}</span>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.customerCell}>
                        <div className={styles.customerName}>{o.customerName || o.customerEmail || '—'}</div>
                        {o.customerEmail && o.customerName ? <div className={styles.customerEmail}>{o.customerEmail}</div> : null}
                      </div>
                      <div className={styles.cardRowMeta}>
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
                            <span className={styles.paymentSubtext}>
                              {(o.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : o.paymentStatus}
                            </span>
                          </div>
                        )}
                        <span className={styles.cardItems}>{o.itemsCount} items</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
      )}

      {/* Order details modal */}
      {selectedOrderId && (
        <div className={styles.orderModalBackdrop}>
          <div className={styles.orderModalPanel}>
            <button
              type="button"
              className={styles.orderModalClose}
              onClick={() => {
                setSelectedOrderId(null);
                setSelectedOrder(null);
                setConfirmAction(null);
              }}
              aria-label="Close"
            >
              ×
            </button>

            {detailsLoading ? (
              <div className={styles.orderModalLoading}>
                <LoadingSpinner />
              </div>
            ) : selectedOrder ? (
              <div className={styles.orderModalInner}>
                <h2 className={styles.orderModalTitle}>
                  <span className={styles.orderModalTitleText}>Order #{selectedOrder.orderNumber}</span>
                  <CopyOrderNumberButton orderNumber={selectedOrder.orderNumber} showToast={showToast} />
                </h2>
                <div className={styles.orderModalSubtitle}>{formatDateTimeIST(selectedOrder.createdAt)}</div>

                <div className={styles.orderModalGrid}>
                  <div className={styles.orderModalInfoCard}>
                    <div className={styles.orderModalInfoHeading}>Customer</div>
                    <div className={styles.orderModalInfoStrong}>{selectedOrder.customer.name || '—'}</div>
                    <div className={styles.orderModalInfoMuted}>{selectedOrder.customer.email || ''}</div>
                  </div>
                  <div className={styles.orderModalInfoCard}>
                    <div className={styles.orderModalInfoHeading}>Delivery Address</div>
                    {selectedOrder.deliveryAddress ? (
                      <div className={styles.orderModalAddress}>
                        <div>{selectedOrder.deliveryAddress.name || ''}</div>
                        <div>{selectedOrder.deliveryAddress.street || ''}</div>
                        <div>
                          {[selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.state, selectedOrder.deliveryAddress.postalCode]
                            .filter(Boolean)
                            .join(', ')}
                        </div>
                        {selectedOrder.deliveryAddress.phone ? <div>Phone: {selectedOrder.deliveryAddress.phone}</div> : null}
                      </div>
                    ) : (
                      <div className={styles.orderModalInfoMuted}>—</div>
                    )}
                  </div>
                </div>

                <div className={styles.orderModalItemsSection}>
                  <div className={styles.orderModalItemsHeading}>Items ({selectedOrder.items.length})</div>
                  {selectedOrder.items.map((it, idx) => (
                    <div key={idx} className={styles.orderModalItemRow}>
                      <div className={styles.orderModalItemThumb}>
                        {it.imageUrl ? <img src={it.imageUrl} alt="" className={styles.orderModalItemImg} /> : null}
                      </div>
                      <div className={styles.orderModalItemMain}>
                        <div className={styles.orderModalItemName}>{it.productName}</div>
                        <div className={styles.orderModalItemMeta}>
                          Qty: {it.quantity}
                          {it.variationSize ? ` • ${it.variationSize}` : ''}
                        </div>
                      </div>
                      <div className={styles.orderModalItemPrice}>₹{it.lineTotal.toFixed(2)}</div>
                    </div>
                  ))}
                </div>

                <div className={styles.orderModalActions}>
                  {selectedOrder.status === 'package_prepared' && (
                    <button type="button" onClick={() => setConfirmAction({ kind: 'out' })} className={styles.orderModalBtnPrimary}>
                      Out for delivery
                    </button>
                  )}

                  {selectedOrder.status === 'out_for_delivery' && (
                    <>
                      <button type="button" onClick={() => setConfirmAction({ kind: 'deliver' })} className={styles.orderModalBtnSuccess}>
                        Mark as deliver
                      </button>
                      <button type="button" onClick={() => setConfirmAction({ kind: 'fulfill' })} className={styles.orderModalBtnSecondary}>
                        Mark as fulfilled
                      </button>
                    </>
                  )}

                  {selectedOrder.status === 'delivered' &&
                    (selectedOrder.paymentMethod || '').toLowerCase() === 'cod' &&
                    (selectedOrder.paymentStatus || '').toLowerCase() !== 'paid' && (
                      <button type="button" onClick={() => setConfirmAction({ kind: 'fulfill' })} className={styles.orderModalBtnSecondary}>
                        Mark as fulfilled
                      </button>
                    )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {confirmAction && (
        <div className={styles.confirmModalBackdrop}>
          <div className={styles.confirmModalPanel}>
            <div className={styles.confirmModalTitle}>Confirm</div>
            <div className={styles.confirmModalText}>
              {confirmAction.kind === 'out' && 'Mark this order as out for delivery?'}
              {confirmAction.kind === 'deliver' && 'Mark this order as delivered?'}
              {confirmAction.kind === 'fulfill' && 'Mark this order as fulfilled? (COD will be set to Paid)'}
            </div>
            <div className={styles.confirmModalActions}>
              <button type="button" onClick={() => setConfirmAction(null)} className={styles.confirmModalBtnCancel}>
                Cancel
              </button>
              <button type="button" onClick={runOrderAction} className={styles.confirmModalBtnOk}>
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  modalTitle,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  modalTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const modalTitleId = useId();

  const selected = options.find((o) => o.value === value) || options[0];
  const useModal = isNarrow;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open || useModal) return;
    const onDocClick = (e: Event) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, useModal]);

  useEffect(() => {
    if (!open || !useModal) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscrollY = html.style.overscrollBehaviorY;
    const prevBodyOverscrollY = body.style.overscrollBehaviorY;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    html.style.overscrollBehaviorY = 'none';
    body.style.overscrollBehaviorY = 'none';
    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehaviorY = prevHtmlOverscrollY;
      body.style.overscrollBehaviorY = prevBodyOverscrollY;
    };
  }, [open, useModal]);

  const optionList = options.map((opt) => {
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
        {isActive ? <span className={styles.dropdownHint}>Selected</span> : null}
      </button>
    );
  });

  return (
    <div className={styles.selectWrap} ref={ref}>
      <button type="button" className={styles.selectButton} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className={styles.selectValue}>{selected?.label}</span>
        <span className={styles.selectChevron} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5.5 7.5L10 12l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && !useModal && (
        <div className={styles.dropdown} role="listbox" aria-label={modalTitle}>
          {optionList}
        </div>
      )}

      {mounted && open && useModal
        ? createPortal(
            <div
              className={styles.selectModalBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                className={styles.selectModalPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={styles.selectModalHeader}>
                  <h2 id={modalTitleId} className={styles.selectModalTitle}>
                    {modalTitle}
                  </h2>
                  <button type="button" className={styles.selectModalClose} aria-label="Close" onClick={() => setOpen(false)}>
                    ×
                  </button>
                </div>
                <div className={styles.selectModalBody} role="listbox" aria-label={modalTitle}>
                  {optionList}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
