'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, productsApi, contentApi } from '@/lib/api';
import { Product } from '@/types';
import { useToast } from '@/contexts/ToastContext';
import { useCart } from '@/contexts/CartContext';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import styles from './page.module.css';
import Link from 'next/link';

type OrderItem = {
  productName: string;
  variationSize: string | null;
  variationId?: number | null;
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
  feedbackSubmitted?: boolean;
  feedbackRating?: string | null;
  vatPercent?: number | null;
  vatAmount?: number | null;
};

// Tick SVG for completed steps
const TickIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.timelineSvg} aria-hidden>
    <path fillRule="evenodd" clipRule="evenodd" d="M16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="currentColor"/>
  </svg>
);

// Icons for incomplete steps: order (clipboard), package (box), truck, delivery (home)
const OrderIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.timelineSvg} aria-hidden>
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
  </svg>
);
const PackageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.timelineSvg} aria-hidden>
    <path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const TruckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.timelineSvg} aria-hidden>
    <path d="M1 3h15v13H1z"/>
    <path d="M16 8h4l3 3v5h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/>
    <circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);
const DeliveryIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.timelineSvg} aria-hidden>
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
);

function getTimelineSteps(order: OrderDetail) {
  const steps: { title: string; description: string; date: string; iconType: 'tick' | 'order' | 'package' | 'truck' | 'delivery'; completed: boolean }[] = [];
  
  steps.push({
    title: 'Order confirmed',
    description: 'Order placed and confirmed',
    date: order.createdAt ? new Date(order.createdAt).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    iconType: 'tick',
    completed: true
  });

  const prepared = order.status === 'package_prepared' || order.status === 'out_for_delivery' || order.status === 'delivered';
  steps.push({
    title: 'Package prepared',
    description: 'Packed and handed to Milko Team',
    date: order.packagePreparedAt ? new Date(order.packagePreparedAt).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    iconType: prepared ? 'tick' : 'package',
    completed: prepared
  });

  const outForDelivery = order.status === 'out_for_delivery' || order.status === 'delivered';
  steps.push({
    title: 'Out for delivery',
    description: 'Will be delivered today',
    date: order.outForDeliveryAt ? new Date(order.outForDeliveryAt).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    iconType: outForDelivery ? 'tick' : 'truck',
    completed: outForDelivery
  });

  const delivered = order.status === 'delivered';
  steps.push({
    title: 'Delivered',
    description: 'Package delivered successfully',
    date: order.deliveredAt ? new Date(order.deliveredAt).toLocaleString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
    iconType: delivered ? 'tick' : 'delivery',
    completed: delivered
  });

  return steps;
}

function TimelineIcon({ iconType }: { iconType: 'tick' | 'order' | 'package' | 'truck' | 'delivery' }) {
  switch (iconType) {
    case 'tick': return <TickIcon />;
    case 'order': return <OrderIcon />;
    case 'package': return <PackageIcon />;
    case 'truck': return <TruckIcon />;
    case 'delivery': return <DeliveryIcon />;
    default: return <TickIcon />;
  }
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.id as string;
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRating, setSelectedRating] = useState<string | null>(null);
  const [feedbackLocked, setFeedbackLocked] = useState(false);
  const [productRatings, setProductRatings] = useState<{ [key: number]: number }>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [helpSupportNumber, setHelpSupportNumber] = useState<string>('');
  const { showToast } = useToast();
  const { addItem } = useCart();

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

  useEffect(() => {
    if (order?.feedbackSubmitted && order.feedbackRating) {
      setSelectedRating(order.feedbackRating);
    }
  }, [order?.feedbackSubmitted, order?.feedbackRating]);

  useEffect(() => {
    contentApi.getByType('help_support').then((c) => {
      setHelpSupportNumber((c?.metadata as { helpSupportNumber?: string })?.helpSupportNumber || '');
    }).catch(() => setHelpSupportNumber(''));
  }, []);

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
  // Payment badge: Cancelled/Refunded from admin (order.status); Paid when money received; else Pending
  const paymentLabel = order.status === 'cancelled' ? 'Cancelled' : order.status === 'refunded' ? 'Refunded' : order.paymentStatus === 'paid' ? 'Paid' : 'Pending';
  const paymentVariant = order.status === 'cancelled' ? 'cancelled' : order.status === 'refunded' ? 'refunded' : order.paymentStatus === 'paid' ? 'paid' : 'pending';
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const variationStr = (() => {
    const v = [...new Set(order.items.map((i) => i.variationSize).filter(Boolean))] as string[];
    return v.length ? ` • ${v.join(', ')}` : '';
  })();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Header */}
        <div className={styles.header}>
          <h1 className={styles.orderTitle}>Order #{order.orderNumber}</h1>
          <div className={`${styles.statusBadge} ${styles[`statusBadge${paymentVariant.charAt(0).toUpperCase()}${paymentVariant.slice(1)}`]}`}>
            {paymentVariant === 'paid' && (
              <svg className={styles.statusBadgeTick} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path fillRule="evenodd" clipRule="evenodd" d="M16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="currentColor"/>
              </svg>
            )}
            {paymentLabel}
          </div>
        </div>

        <div className={styles.orderDateRow}>
          <span className={styles.orderDate}>
            {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
          </span>
          <span className={styles.orderTotal}>
            {' • '}Qty: {totalQty}{variationStr} • ₹{order.total.toFixed(2)}
          </span>
        </div>

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
            <span>₹{order.subtotal.toFixed(2)}</span>
          </div>
          {order.vatPercent != null && order.vatAmount != null && (
            <div className={styles.pricingRow}>
              <span>VAT/GST ({order.vatPercent}%)</span>
              <span>₹{order.vatAmount.toFixed(2)}</span>
            </div>
          )}
          <div className={`${styles.pricingRow} ${styles.totalRow}`}>
            <span>Total</span>
            <span>₹{order.total.toFixed(2)}</span>
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

        {/* TIMELINE — all steps shown; completed = tick + normal, not yet completed = little gray */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>TIMELINE</h2>
          <div className={styles.timeline}>
            {timelineSteps.map((step, idx) => (
              <div key={idx} className={`${styles.timelineStep} ${!step.completed ? styles.timelineStepIncomplete : ''}`}>
                <div className={`${styles.timelineIcon} ${step.completed ? styles.timelineIconCompleted : ''}`}>
                  <TimelineIcon iconType={step.iconType} />
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

        {/* RECOMMENDATION SECTION - Only show if delivered. Locked after submit or if already submitted. */}
        {order.status === 'delivered' && (
          <section className={styles.section}>
            <h2 className={styles.recommendationTitle}>
              How likely are you to recommend Milko to friends and family?
            </h2>
            <div className={styles.ratingOptions}>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'least' ? styles.ratingOptionSelected : ''}`}
                disabled={!!(order.feedbackSubmitted || feedbackLocked)}
                onClick={async () => {
                  if (order.feedbackSubmitted || feedbackLocked) return;
                  setSelectedRating('least');
                  try {
                    await apiClient.post(`/api/orders/${orderId}/feedback`, { rating: 'least' });
                    setFeedbackLocked(true);
                  } catch {
                    setSelectedRating(null);
                  }
                }}
              >
                <span className={styles.ratingEmoji}>😔</span>
                <span className={styles.ratingLabel}>Least likely</span>
              </button>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'neutral' ? styles.ratingOptionSelected : ''}`}
                disabled={!!(order.feedbackSubmitted || feedbackLocked)}
                onClick={async () => {
                  if (order.feedbackSubmitted || feedbackLocked) return;
                  setSelectedRating('neutral');
                  try {
                    await apiClient.post(`/api/orders/${orderId}/feedback`, { rating: 'neutral' });
                    setFeedbackLocked(true);
                  } catch {
                    setSelectedRating(null);
                  }
                }}
              >
                <span className={styles.ratingEmoji}>😐</span>
                <span className={styles.ratingLabel}>Neutral</span>
              </button>
              <button
                className={`${styles.ratingOption} ${selectedRating === 'most' ? styles.ratingOptionSelected : ''}`}
                disabled={!!(order.feedbackSubmitted || feedbackLocked)}
                onClick={async () => {
                  if (order.feedbackSubmitted || feedbackLocked) return;
                  setSelectedRating('most');
                  try {
                    await apiClient.post(`/api/orders/${orderId}/feedback`, { rating: 'most' });
                    setFeedbackLocked(true);
                  } catch {
                    setSelectedRating(null);
                  }
                }}
              >
                <span className={styles.ratingEmoji}>😊</span>
                <span className={styles.ratingLabel}>Most Likely</span>
              </button>
            </div>
            {(order.feedbackSubmitted || feedbackLocked) && selectedRating && (
              <p className={styles.ratingThankYou}>Boht Boht Sukhriya</p>
            )}
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
                <div
                  className={`${styles.productCardTop} ${item.productId ? styles.productCardTopClickable : ''}`}
                  role={item.productId ? 'button' : undefined}
                  tabIndex={item.productId ? 0 : undefined}
                  onClick={item.productId ? async () => {
                    try {
                      const p = await productsApi.getById(String(item.productId), true);
                      setSelectedProduct(p);
                      setIsProductModalOpen(true);
                    } catch {
                      showToast('Product not found', 'error');
                    }
                  } : undefined}
                  onKeyDown={item.productId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); (e.currentTarget as HTMLDivElement).click(); } } : undefined}
                >
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
          {order.status === 'delivered' && (
            <div className={styles.deliveredActions}>
              <button
                type="button"
                className={styles.deliveredActionBtn}
                onClick={() => {
                  const raw = (helpSupportNumber || '').trim();
                  if (!raw) {
                    showToast('Help number not configured', 'error');
                    return;
                  }
                  if (/^https?:\/\//i.test(raw)) {
                    window.open(raw, '_blank');
                  } else {
                    const digits = raw.replace(/\D/g, '');
                    window.open(`https://wa.me/${digits || '0'}`, '_blank');
                  }
                }}
              >
                Need help
              </button>
              <button
                type="button"
                className={styles.deliveredActionBtn}
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
                Buy again
              </button>
            </div>
          )}
        </section>
      </div>

      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          isOpen={isProductModalOpen}
          onClose={() => {
            setIsProductModalOpen(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}
