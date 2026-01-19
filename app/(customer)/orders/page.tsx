'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import styles from './page.module.css';

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
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

function getDeliveryDisplay(order: MyOrder): string {
  if (order.status === 'cancelled') return '—';
  if (order.status === 'placed' || order.status === 'confirmed') return 'On its way';
  if (order.status === 'delivered') {
    if (order.deliveryDate) {
      try {
        return new Date(order.deliveryDate).toLocaleDateString();
      } catch {
        return 'Delivered';
      }
    }
    return 'Delivered';
  }
  return '—';
}

/**
 * My Orders Page
 * One row per order item: image (left), product name, item, variation, order date, delivery (right)
 */
export default function OrdersPage() {
  const [orders, setOrders] = useState<MyOrder[]>([]);
  const [loading, setLoading] = useState(true);

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
  };
  const demoItem: OrderItem = {
    productName: 'Delivered Product',
    variationSize: null,
    quantity: 1,
    unitPrice: 0,
    lineTotal: 0,
    productId: null,
    imageUrl: null,
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
          const isOnTheWay = order.status === 'placed' || order.status === 'confirmed';
          const orderDate = order.createdAt
            ? new Date(order.createdAt).toLocaleDateString()
            : '—';
          const itemLabel = `Qty ${item.quantity}`;
          const variation = item.variationSize ? item.variationSize : null;
          return (
            <div key={`${order.id}-${idx}`} className={styles.orderRow}>
              <div className={styles.orderRowTop}>
                <div className={styles.orderRowImage}>
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt="" />
                  ) : (
                    <div className={styles.orderRowImagePlaceholder}>📦</div>
                  )}
                </div>
                <div className={styles.orderRowDetails}>
                  <h3 className={styles.orderRowName}>{item.productName}</h3>
                  <p className={styles.orderRowMeta}>
                    <span>{itemLabel}</span>
                    {variation && <span>{variation}</span>}
                    <span>Order #{order.orderNumber}</span>
                    <span>Ordered {orderDate}</span>
                  </p>
                  <p
                    className={`${styles.orderRowDelivery} ${
                      isOnTheWay ? styles.orderRowDeliveryOnTheWay : ''
                    }`}
                  >
                    {isOnTheWay ? 'On its way' : `Delivery: ${deliveryDisplay}`}
                  </p>
                </div>
              </div>
              {order.status === 'delivered' && (
                <>
                  <div className={styles.orderRowRate}>
                    <span className={styles.orderRowRateIcon} aria-hidden>★</span>
                    <span>Rate this product</span>
                    <svg className={styles.orderRowRateArrow} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M14 5l7 7m0 0l-7 7m7-7H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className={styles.orderRowActions}>
                    <Link href="/products" className={styles.orderRowBtn}>View details</Link>
                    <Link href="/products" className={styles.orderRowBtn}>
                      <svg className={styles.orderRowBtnIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                      </svg>
                      Buy again
                    </Link>
                  </div>
                </>
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
    </div>
  );
}
