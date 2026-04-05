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

type OrderLine = { item: OrderItem; orderItemIndex: number };

type OrderGroup = {
  order: MyOrder;
  lines: OrderLine[];
};

function isSubscriptionOrderItem(item: OrderItem): boolean {
  return (item.productName || '').trim().toLowerCase().startsWith('subscription for ');
}

/** Line items the customer can rate (excludes subscription rows). */
function countRatableOrderItems(order: MyOrder): number {
  return order.items.filter((i) => !isSubscriptionOrderItem(i) && i.productId != null).length;
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
 * My Orders — one compact row per order (first product preview). More lines: +x on image; full list on order details.
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

  const orderGroups: OrderGroup[] = [];
  for (const order of orders) {
    const lines: OrderLine[] = [];
    for (let orderItemIndex = 0; orderItemIndex < (order.items || []).length; orderItemIndex++) {
      const item = order.items[orderItemIndex];
      if (isSubscriptionOrderItem(item)) continue;
      lines.push({ item, orderItemIndex });
    }
    if (lines.length === 0) continue;
    orderGroups.push({ order, lines });
  }

  orderGroups.sort((a, b) => {
    const ta = a.order.createdAt ? new Date(a.order.createdAt).getTime() : 0;
    const tb = b.order.createdAt ? new Date(b.order.createdAt).getTime() : 0;
    return tb - ta;
  });

  // Group by month: each month lists whole orders (not split per line item)
  const monthGroups: { key: string; label: string; orderGroups: OrderGroup[]; itemCount: number }[] = (() => {
    const map = new Map<string, { label: string; orderGroups: OrderGroup[] }>();
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth();

    for (const og of orderGroups) {
      const d = og.order.createdAt ? new Date(og.order.createdAt) : new Date();
      const y = d.getFullYear();
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!map.has(key)) {
        const monthName = d.toLocaleString('en-US', { month: 'long' });
        const label = y === thisYear && m === thisMonth ? `This month (${monthName})` : `${monthName} ${y}`;
        map.set(key, { label, orderGroups: [] });
      }
      map.get(key)!.orderGroups.push(og);
    }

    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, { label, orderGroups: ogs }]) => ({
        key,
        label,
        orderGroups: ogs,
        itemCount: ogs.reduce((sum, g) => sum + g.lines.length, 0),
      }));
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
        {monthGroups.map(({ key, label, orderGroups: monthOrderGroups, itemCount }) => (
          <div key={key} className={styles.monthGroup}>
            <div className={styles.monthGroupHeader}>
              <span className={styles.monthGroupLabel}>{label}</span>
              <span className={styles.monthGroupCount}>
                {itemCount} item{itemCount !== 1 ? 's' : ''} ordered
              </span>
            </div>
            <div className={styles.monthGroupRows}>
              {monthOrderGroups.map(({ order, lines }) => {
                const preview = lines[0];
                const item = preview.item;
                const extraProductCount = lines.length - 1;
                const deliveryDisplay = getDeliveryDisplay(order);
                const onTheWay = isOnTheWay(order);
                const orderDate = fmtDdMmYy(order.createdAt);
                const itemLabel = `Qty ${item.quantity}`;
                const variation = item.variationSize ? item.variationSize : null;
                const ratableLineCount = countRatableOrderItems(order);
                const ratableItems = order.items.filter(
                  (i) => !isSubscriptionOrderItem(i) && i.productId != null,
                );
                const allRatableLinesRated =
                  ratableLineCount > 1 &&
                  ratableItems.every(
                    (i) => i.detailedFeedback != null && i.detailedFeedback.qualityStars >= 1,
                  );
                const scrollToFirstUnratedItemIndex = (): number => {
                  for (let i = 0; i < order.items.length; i++) {
                    const it = order.items[i];
                    if (isSubscriptionOrderItem(it) || it.productId == null) continue;
                    if (it.detailedFeedback == null || it.detailedFeedback.qualityStars < 1) return i;
                  }
                  return preview.orderItemIndex;
                };
                const openRateOrDetails = () => {
                  if (item.productId == null) return;
                  if (ratableLineCount <= 1) {
                    setRatingModal({ order, productId: item.productId });
                  } else {
                    router.push(
                      `/orders/${order.id}#order-item-${scrollToFirstUnratedItemIndex()}`,
                    );
                  }
                };
                return (
                  <div key={order.id} className={styles.orderRow}>
                    <button
                      type="button"
                      className={styles.orderNumberBadge}
                      onClick={() => {
                        navigator.clipboard
                          .writeText(order.orderNumber)
                          .then(() => showToast('Copied!', 'success'))
                          .catch(() => {});
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
                          {extraProductCount > 0 ? (
                            <div className={styles.productCountBadge} aria-hidden>
                              +{extraProductCount}
                            </div>
                          ) : null}
                        </div>
                        <div className={styles.orderRowTotal}>₹{order.total.toFixed(2)}</div>
                      </div>
                      <div className={styles.orderRowDetails}>
                        <h3 className={styles.orderRowName}>{item.productName}</h3>
                        <p className={styles.orderRowMeta}>
                          <span>{itemLabel}</span>
                          {variation ? <span>{variation}</span> : null}
                          <span>Ordered {orderDate}</span>
                        </p>
                        <p
                          className={`${styles.orderRowDelivery} ${
                            onTheWay ? styles.orderRowDeliveryOnTheWay : ''
                          }`}
                        >
                          {onTheWay && (
                            <svg className={styles.orderRowDeliveryIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                          )}
                          {onTheWay ? <span>On its way</span> : `Delivery: ${deliveryDisplay}`}
                        </p>
                      </div>
                    </div>
                    {order.status === 'delivered' && (
                      <>
                        {ratableLineCount <= 1 &&
                        item.detailedFeedback != null &&
                        item.detailedFeedback.qualityStars >= 1 ? (
                          <div className={styles.orderRowRated}>
                            <span className={styles.orderRowRateIcon} aria-hidden>
                              ★
                            </span>
                            <span>
                              You rated {item.detailedFeedback.qualityStars} star
                              {item.detailedFeedback.qualityStars !== 1 ? 's' : ''}
                            </span>
                          </div>
                        ) : null}
                        {ratableLineCount <= 1 &&
                        (item.detailedFeedback == null || item.detailedFeedback.qualityStars < 1) &&
                        item.productId != null ? (
                          <div
                            className={styles.orderRowRate}
                            role="button"
                            tabIndex={0}
                            onClick={openRateOrDetails}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openRateOrDetails();
                              }
                            }}
                          >
                            <span className={styles.orderRowRateIcon} aria-hidden>
                              ★
                            </span>
                            <span>Rate this product</span>
                            <svg
                              className={styles.orderRowRateArrow}
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden
                            >
                              <path
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        ) : null}
                        {ratableLineCount > 1 && allRatableLinesRated ? (
                          <div className={styles.orderRowRated}>
                            <span className={styles.orderRowRateIcon} aria-hidden>
                              ★
                            </span>
                            <span>You rated all products in this order</span>
                          </div>
                        ) : null}
                        {ratableLineCount > 1 && !allRatableLinesRated ? (
                          <div
                            className={styles.orderRowRate}
                            role="button"
                            tabIndex={0}
                            onClick={openRateOrDetails}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openRateOrDetails();
                              }
                            }}
                          >
                            <span className={styles.orderRowRateIcon} aria-hidden>
                              ★
                            </span>
                            <span>Rate products</span>
                            <svg
                              className={styles.orderRowRateArrow}
                              viewBox="0 0 24 24"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden
                            >
                              <path
                                d="M14 5l7 7m0 0l-7 7m7-7H3"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        ) : null}
                        <div className={styles.orderRowActions}>
                          <Link href={`/orders/${order.id}`} className={styles.orderRowBtn}>
                            View details
                          </Link>
                          <button
                            type="button"
                            className={styles.orderRowBtn}
                            onClick={() => {
                              order.items.forEach((it) => {
                                if (it.productId != null && !isSubscriptionOrderItem(it)) {
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
                            <svg
                              className={styles.orderRowBtnIcon}
                              viewBox="0 0 24 24"
                              fill="currentColor"
                              xmlns="http://www.w3.org/2000/svg"
                              aria-hidden
                            >
                              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                            </svg>
                            Buy again
                          </button>
                        </div>
                      </>
                    )}
                    {order.status !== 'delivered' && (
                      <div className={styles.orderRowActions}>
                        <Link href={`/orders/${order.id}`} className={styles.orderRowBtn}>
                          View details
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {!loading && monthGroups.length === 0 && (
        <div className={styles.emptyWrap}>
          <p className={styles.emptyText}>
            {orders.length === 0
              ? 'You don&apos;t have any orders yet.'
              : 'No product orders to show here yet.'}
          </p>
          <Link href="/products" className={styles.browseLink}>
            Browse Products
          </Link>
        </div>
      )}

      <HowWasItModal
        isOpen={!!ratingModal}
        onClose={() => setRatingModal(null)}
        order={
          ratingModal
            ? {
                id: ratingModal.order.id,
                // Filter to the rated product so the modal can infer it without productId prop.
                items: ratingModal.order.items
                  .filter((i) => i.productId === ratingModal.productId)
                  .map((i) => ({ productId: i.productId })),
              }
            : null
        }
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
