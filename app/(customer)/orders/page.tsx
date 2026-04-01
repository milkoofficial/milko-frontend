'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import HowWasItModal from '@/components/HowWasItModal';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';
import styles from './page.module.css';
import { formatDdMmYyIST, formatFullDateIST } from '@/lib/utils/datetime';

function fmtDdMmYy(iso: string | null | undefined): string {
  const s = formatDdMmYyIST(iso);
  return s || '—';
}

function fmtDeliveryDate(iso: string | null | undefined): string {
  if (!iso) return 'Delivered';
  return formatFullDateIST(iso) || 'Delivered';
}

type DetailedFeedback = {
  qualityStars: number;
  deliveryAgentStars: number | null;
  onTimeStars: number | null;
  valueForMoneyStars: number | null;
  wouldOrderAgain: string | null;
};

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
  variationId?: number | null;
  detailedFeedback?: DetailedFeedback | null;
};

type MyOrder = {
  id: string;
  orderNumber: string;
  createdAt: string | null;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  itemsCount: number;
  deliveryDate: string | null;
  items: OrderItem[];
};

function isSubscriptionOrderItem(item: OrderItem): boolean {
  return (item.productName || '').trim().toLowerCase().startsWith('subscription for ');
}

function getDeliveryDisplay(order: MyOrder): string {
  if (order.status === 'cancelled' || order.status === 'refunded') return '—';
  // On its way: placed, confirmed, package_prepared, out_for_delivery
  if (['placed', 'confirmed', 'package_prepared', 'out_for_delivery'].includes(order.status)) return 'On its way';
  if (order.status === 'delivered') {
    if (order.deliveryDate) return fmtDeliveryDate(order.deliveryDate);
    return 'Delivered';
  }
  return '—';
}

function isOnTheWay(order: MyOrder): boolean {
  return ['placed', 'confirmed', 'package_prepared', 'out_for_delivery'].includes(order.status);
}

/**
 * My Orders Page
 * One row per order item: image (left), product name, item, variation, order date, delivery (right)
 */
export default function OrdersPage() {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingModal, setRatingModal] = useState<{ order: MyOrder; productId: number } | null>(null);
  const { showToast } = useToast();
  const { addItem } = useCart();
  const router = useRouter();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await apiClient.get<MyOrder[]>('/api/orders');
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  // Flatten to one row per item; each row needs order-level orderDate and deliveryDisplay
  const rows: { item: OrderItem; order: MyOrder; orderItemIndex: number }[] = [];
  for (const order of orders) {
    for (let orderItemIndex = 0; orderItemIndex < (order.items || []).length; orderItemIndex++) {
      const item = order.items[orderItemIndex];
      if (isSubscriptionOrderItem(item)) continue;
      rows.push({ item, order, orderItemIndex });
    }
  }

  const displayRows = [...rows].sort((a, b) => {
    const ta = a.order.createdAt ? new Date(a.order.createdAt).getTime() : 0;
    const tb = b.order.createdAt ? new Date(b.order.createdAt).getTime() : 0;
    return tb - ta;
  });

  // Group by month: { key, label, rows } — label is "This month (January)" or "December 2025"
  const monthGroups: { key: string; label: string; rows: { item: OrderItem; order: MyOrder; orderItemIndex: number }[] }[] = (() => {
    const map = new Map<string, { label: string; rows: { item: OrderItem; order: MyOrder; orderItemIndex: number }[] }>();
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    for (const row of displayRows) {
      const d = row.order.createdAt ? new Date(row.order.createdAt) : new Date();
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        const monthName = d.toLocaleString('en-US', { month: 'long' });
        const label = y === thisYear && m === thisMonth ? `This month (${monthName})` : `${monthName} ${y}`;
        map.set(key, { label, rows: [] });
      }
      map.get(key)!.rows.push(row);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, { label, rows }]) => ({ key, label, rows }));
  })();

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>My Orders</h1>

      <div className={styles.ordersList}>
        {monthGroups.map(({ key, label, rows }) => (
          <div key={key} className={styles.monthGroup}>
            <div className={styles.monthGroupHeader}>
              <span className={styles.monthGroupLabel}>{label}</span>
              <span className={styles.monthGroupCount}>{rows.length} items ordered</span>
            </div>
            <div className={styles.monthGroupRows}>
            {rows.map(({ item, order, orderItemIndex }, idx) => {
          const deliveryDisplay = getDeliveryDisplay(order);
          const onTheWay = isOnTheWay(order);
          const orderDate = fmtDdMmYy(order.createdAt);
          const itemLabel = `Qty ${item.quantity}`;
          const variation = item.variationSize ? item.variationSize : null;
          return (
            <div key={`${order.id}-${idx}`} className={styles.orderRow}>
              <button
                type="button"
                className={styles.orderNumberBadge}
                onClick={() => {
                  navigator.clipboard.writeText(order.orderNumber).then(() => showToast('Copied!', 'success')).catch(() => {});
                }}
              >
                #{order.orderNumber}
              </button>
              <div className={styles.orderRowTop}>
                <div className={styles.orderRowImageWrap}>
                  <div className={styles.orderRowImage}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" />
                    ) : (
                      <div className={styles.orderRowImagePlaceholder}>📦</div>
                    )}
                    {order.items.length > 1 && orderItemIndex === 0 && (
                      <div className={styles.productCountBadge}>+{order.items.length - 1}</div>
                    )}
                  </div>
                  <div className={styles.orderRowTotal}>₹{order.total.toFixed(2)}</div>
                </div>
                <div className={styles.orderRowDetails}>
                  <h3 className={styles.orderRowName}>{item.productName}</h3>
                  <p className={styles.orderRowMeta}>
                    <span>{itemLabel}</span>
                    {variation && <span>{variation}</span>}
                    <span>Ordered {orderDate}</span>
                  </p>
                  <p
                    className={`${styles.orderRowDelivery} ${
                      onTheWay ? styles.orderRowDeliveryOnTheWay : ''
                    }`}
                  >
                    {onTheWay && (
                      <svg className={styles.orderRowDeliveryIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                    )}
                    {onTheWay ? <span>On its way</span> : `Delivery: ${deliveryDisplay}`}
                  </p>
                </div>
              </div>
              {/* Delivered: Rate this product (or You rated X star) + View details + Buy again */}
              {order.status === 'delivered' && (
                <>
                  {item.detailedFeedback != null && item.detailedFeedback.qualityStars >= 1 ? (
                    <div className={styles.orderRowRated}>
                      <span className={styles.orderRowRateIcon} aria-hidden>★</span>
                      <span>You rated {item.detailedFeedback.qualityStars} star{item.detailedFeedback.qualityStars !== 1 ? 's' : ''}</span>
                    </div>
                  ) : item.productId != null ? (
                    <div
                      className={styles.orderRowRate}
                      role="button"
                      tabIndex={0}
                      onClick={() => setRatingModal({ order, productId: item.productId! })}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRatingModal({ order, productId: item.productId! }); } }}
                    >
                      <span className={styles.orderRowRateIcon} aria-hidden>★</span>
                      <span>Rate this product</span>
                      <svg className={styles.orderRowRateArrow} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M14 5l7 7m0 0l-7 7m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  ) : null}
                  <div className={styles.orderRowActions}>
                    <Link href={`/orders/${order.id}`} className={styles.orderRowBtn}>View details</Link>
                    <button
                      type="button"
                      className={styles.orderRowBtn}
                      onClick={() => {
                        order.items.forEach((it) => {
                          if (it.productId != null) {
                            addItem({
                              productId: String(it.productId),
                              quantity: it.quantity,
                              variationId: it.variationId != null ? String(it.variationId) : undefined,
                            });
                          }
                        });
                        router.push('/cart');
                      }}
                    >
                      <svg className={styles.orderRowBtnIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                      Buy again
                    </button>
                  </div>
                </>
              )}
              {/* On its way (or cancelled/refunded): only View details */}
              {order.status !== 'delivered' && (
                <div className={styles.orderRowActions}>
                  <Link href={`/orders/${order.id}`} className={styles.orderRowBtn}>View details</Link>
                </div>
              )}
            </div>
          );
        })}
            </div>
          </div>
        ))}
      </div>

      {orders.length === 0 && (
        <div className={styles.emptyWrap}>
          <p className={styles.emptyText}>You don&apos;t have any orders yet.</p>
          <Link href="/products" className={styles.browseLink}>
            Browse Products
          </Link>
        </div>
      )}

      <HowWasItModal
        isOpen={!!ratingModal}
        onClose={() => setRatingModal(null)}
        order={ratingModal ? { id: ratingModal.order.id, items: ratingModal.order.items } : null}
        productId={ratingModal?.productId ?? null}
        onSubmitSuccess={async () => {
          setRatingModal(null);
          try {
            const data = await apiClient.get<MyOrder[]>('/api/orders');
            setOrders(Array.isArray(data) ? data : []);
          } catch {
            /* keep list */
          }
        }}
      />
    </div>
  );
}
