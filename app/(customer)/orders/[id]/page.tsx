'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import styles from './page.module.css';
import Link from 'next/link';

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
};

type OrderDetail = {
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
  createdAt: string;
  deliveryDate: string | null;
  packagePreparedAt?: string | null;
  outForDeliveryAt?: string | null;
  deliveredAt?: string | null;
  customer: {
    name: string;
    email: string;
  };
  items: OrderItem[];
};

// Timeline steps based on order status
function getTimelineSteps(order: OrderDetail) {
  const steps = [];
  
  // Order confirmed
  steps.push({
    title: 'Order confirmed',
    description: 'Order placed and confirmed',
    date: order.createdAt ? new Date(order.createdAt).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '',
    icon: '✅',
    completed: true
  });

  // Package prepared
  const prepared = order.status === 'package_prepared' || order.status === 'out_for_delivery' || order.status === 'delivered';
  steps.push({
    title: 'Package prepared',
    description: 'Packed and handed to DHL Express',
    date: order.packagePreparedAt ? new Date(order.packagePreparedAt).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '',
    icon: '🎁',
    completed: prepared
  });

  // Out for delivery
  const outForDelivery = order.status === 'out_for_delivery' || order.status === 'delivered';
  steps.push({
    title: 'Out for delivery',
    description: 'Will be delivered today',
    date: order.outForDeliveryAt ? new Date(order.outForDeliveryAt).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '',
    icon: '📍',
    completed: outForDelivery
  });

  // Delivered
  const delivered = order.status === 'delivered';
  steps.push({
    title: 'Delivered',
    description: 'Package delivered successfully',
    date: order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : '',
    icon: '✅',
    completed: delivered
  });

  return steps;
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [productRatings, setProductRatings] = useState<{ [key: number]: number }>({});

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const data = await apiClient.get<OrderDetail>(`/api/orders/${orderId}`);
        setOrder(data);
      } catch (err: any) {
        console.error('Failed to fetch order:', err);
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrder();
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading order details...</div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error || 'Order not found'}</div>
        <Link href="/orders" className={styles.backLink}>← Back to orders</Link>
      </div>
    );
  }

  const timelineSteps = getTimelineSteps(order);
  const isPaid = order.paymentStatus === 'paid' || order.paymentStatus === 'cod';

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.orderTitle}>Order #{order.orderNumber}</h1>
          <div className={styles.statusBadge}>
            {isPaid ? 'Paid' : order.paymentStatus}
          </div>
          <button className={styles.menuButton}>⋮</button>
        </div>

        <p className={styles.orderDate}>
          {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : ''} • ${order.total.toFixed(2)}
        </p>

        {/* ORDER SUMMARY */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ORDER SUMMARY</h2>
          {order.items.map((item, idx) => (
            <div key={idx} className={styles.orderItem}>
              <div className={styles.orderItemImage}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.productName} />
                ) : (
                  <div className={styles.orderItemImagePlaceholder}>📦</div>
                )}
              </div>
              <div className={styles.orderItemDetails}>
                <h3 className={styles.orderItemName}>{item.productName}</h3>
                <p className={styles.orderItemVariation}>{item.variationSize || ''}</p>
              </div>
            </div>
          ))}

          <div className={styles.pricingRow}>
            <span>Subtotal</span>
            <span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className={styles.pricingRow}>
            <span>VAT (20.00%)</span>
            <span>${(order.subtotal * 0.2).toFixed(2)}</span>
          </div>
          <div className={`${styles.pricingRow} ${styles.totalRow}`}>
            <span>Total</span>
            <span>${order.total.toFixed(2)}</span>
          </div>
        </section>

        {/* CUSTOMER */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>CUSTOMER</h2>
          <div className={styles.customerInfo}>
            <div className={styles.customerAvatar}>
              {order.customer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className={styles.customerName}>{order.customer.name}</h3>
              <p className={styles.customerEmail}>{order.customer.email}</p>
            </div>
          </div>
        </section>

        {/* TIMELINE */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>TIMELINE</h2>
          <div className={styles.timeline}>
            {timelineSteps.map((step, idx) => (
              <div key={idx} className={styles.timelineStep}>
                <div className={`${styles.timelineIcon} ${step.completed ? styles.timelineIconCompleted : ''}`}>
                  {step.icon}
                </div>
                <div className={styles.timelineContent}>
                  <h3 className={styles.timelineTitle}>{step.title}</h3>
                  <p className={styles.timelineDescription}>{step.description}</p>
                  {step.date && <p className={styles.timelineDate}>{step.date}</p>}
                </div>
                {idx < timelineSteps.length - 1 && (
                  <div className={`${styles.timelineLine} ${step.completed ? styles.timelineLineCompleted : ''}`}></div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* RECOMMENDATION SECTION - Only show if delivered */}
        {order.status === 'delivered' && (
          <section className={styles.section}>
            <h2 className={styles.recommendationTitle}>
              How likely are you to recommend Jiomart to friends and family?
            </h2>
            <div className={styles.ratingOptions}>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'least' ? styles.ratingOptionSelected : ''}`}
                onClick={() => setSelectedRating('least')}
              >
                <span className={styles.ratingEmoji}>😔</span>
                <span className={styles.ratingLabel}>Least likely</span>
              </button>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'neutral' ? styles.ratingOptionSelected : ''}`}
                onClick={() => setSelectedRating('neutral')}
              >
                <span className={styles.ratingEmoji}>😐</span>
                <span className={styles.ratingLabel}>Neutral</span>
              </button>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'most' ? styles.ratingOptionSelected : ''}`}
                onClick={() => setSelectedRating('most')}
              >
                <span className={styles.ratingEmoji}>😊</span>
                <span className={styles.ratingLabel}>Most Likely</span>
              </button>
            </div>
          </section>
        )}

        {/* ORDER DETAILS */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ORDER DETAILS</h2>
          <div className={styles.detailsGrid}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Name</span>
              <span className={styles.detailValue}>{order.customer.name}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order Number</span>
              <span className={styles.detailValue}>{order.orderNumber}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Shipment Number</span>
              <span className={styles.detailValue}>{order.orderNumber}-01</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order Date</span>
              <span className={styles.detailValue}>
                {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                }) : ''}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Product Total</span>
              <span className={styles.detailValue}>₹{order.subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Delivery Fee</span>
              <span className={styles.detailValue}>
                <span className={styles.freeTag}>FREE</span>
                {order.deliveryCharges > 0 && (
                  <span className={styles.strikethrough}>₹{order.deliveryCharges.toFixed(2)}</span>
                )}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Order Amount</span>
              <span className={styles.detailValue}>₹{order.total.toFixed(2)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Invoice Number</span>
              <span className={styles.detailValue}>
                T42I{order.orderNumber.substring(0, 10)}I
                <button className={styles.downloadIcon} title="Download Invoice">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                </button>
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Invoice Amount</span>
              <span className={styles.detailValue}>₹{order.total.toFixed(2)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Payment Mode</span>
              <span className={styles.detailValue}>{order.paymentMethod.toUpperCase()}</span>
            </div>
          </div>
        </section>

        {/* ORDER ITEMS WITH RATINGS */}
        <section className={styles.section}>
          <h2 className={styles.orderItemsTitle}>Order Items ({order.items.length})</h2>
          <div className={styles.orderItemsList}>
            {order.items.map((item, idx) => (
              <div key={idx} className={styles.productCard}>
                <div className={styles.productCardTop}>
                  <div className={styles.productImageWrapper}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.productName} className={styles.productCardImage} />
                    ) : (
                      <div className={styles.productImagePlaceholder}>📦</div>
                    )}
                    {order.items.length > 1 && idx === 0 && (
                      <div className={styles.productCountBadge}>+{order.items.length - 1}</div>
                    )}
                  </div>
                  <div className={styles.productCardInfo}>
                    <h3 className={styles.productCardName}>{item.productName}</h3>
                    <p className={styles.productCardPrice}>₹{item.lineTotal.toFixed(2)}</p>
                    <p className={styles.productCardQuantity}>Qty: {item.quantity}</p>
                  </div>
                </div>
                
                {order.status === 'delivered' && (
                  <div className={styles.productRating}>
                    <span className={styles.rateLabel}>Rate this product:</span>
                    <div className={styles.stars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          className={`${styles.star} ${productRatings[idx] >= star ? styles.starActive : ''}`}
                          onClick={() => setProductRatings({ ...productRatings, [idx]: star })}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
