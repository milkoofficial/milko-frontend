'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import HowWasItModal from '@/components/HowWasItModal';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';
import styles from './page.module.css';

function fmtDdMmYy(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
}

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
  variationId?: number | null;
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
  qualityStars?: number | null;
};

function getDeliveryDisplay(order: MyOrder): string {
  if (order.status === 'cancelled' || order.status === 'refunded') return '—';
  // On its way: placed, confirmed, package_prepared, out_for_delivery
  if (['placed', 'confirmed', 'package_prepared', 'out_for_delivery'].includes(order.status)) return 'On its way';
  if (order.status === 'delivered') {
    if (order.deliveryDate) return fmtDdMmYy(order.deliveryDate);
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
  const [ratingModalOrder, setRatingModalOrder] = useState<MyOrder | null>(null);
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
  const rows: { item: OrderItem; order: MyOrder }[] = [];
  for (const order of orders) {
    for (const item of order.items || []) {
      rows.push({ item, order });
    }
  }

  // Demo "Delivered Product" shown in the same list as real items (on its way or delivered)
  const demoItem: OrderItem = {
    productName: 'Delivered Product',
    variationSize: null,
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
    productId: null,
    imageUrl: null,
  };
  const demoOrder: MyOrder = {
    id: 'demo',
    orderNumber: 'DEMO-001',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'delivered',
    paymentMethod: 'cod',
    paymentStatus: 'cod',
    itemsCount: 1,
    total: 0,
    deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    items: [demoItem],
  };
  const displayRows: { item: OrderItem; order: MyOrder }[] = [...rows, { item: demoItem, order: demoOrder }].sort(
    (a, b) => {
      const ta = a.order.createdAt ? new Date(a.order.createdAt).getTime() : 0;
      const tb = b.order.createdAt ? new Date(b.order.createdAt).getTime() : 0;
      return tb - ta; // newest first, irrespective of delivered or on its way
    }
  );

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
        {displayRows.map(({ item, order }, idx) => {
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
                    {onTheWay ? 'On its way' : `Delivery: ${deliveryDisplay}`}
                  </p>
                </div>
              </div>
              {/* Delivered: Rate this product (or You rated X star) + View details + Buy again */}
              {order.status === 'delivered' && (
                <>
                  {order.qualityStars != null && order.qualityStars >= 1 ? (
                    <div className={styles.orderRowRated}>
                      <span className={styles.orderRowRateIcon} aria-hidden>★</span>
                      <span>You rated {order.qualityStars} star{order.qualityStars !== 1 ? 's' : ''}</span>
                    </div>
                  ) : (
                    <div
                      className={styles.orderRowRate}
                      role="button"
                      tabIndex={0}
                      onClick={() => setRatingModalOrder(order)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRatingModalOrder(order); } }}
                    >
                      <span className={styles.orderRowRateIcon} aria-hidden>★</span>
                      <span>Rate this product</span>
                      <svg className={styles.orderRowRateArrow} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M14 5l7 7m0 0l-7 7m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
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

      {orders.length === 0 && (
        <div className={styles.emptyWrap}>
          <p className={styles.emptyText}>You don&apos;t have any orders yet.</p>
          <Link href="/products" className={styles.browseLink}>
            Browse Products
          </Link>
        </div>
      )}

      <HowWasItModal
        isOpen={!!ratingModalOrder}
        onClose={() => setRatingModalOrder(null)}
        order={ratingModalOrder}
        onSubmitSuccess={(qualityStars) => {
          if (ratingModalOrder?.id) {
            setOrders((prev) => prev.map((o) => (o.id === ratingModalOrder.id ? { ...o, qualityStars } : o)));
          }
          setRatingModalOrder(null);
        }}
      />
    </div>
  );
}
