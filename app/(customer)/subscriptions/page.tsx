'use client';

import { useEffect, useState } from 'react';
import { subscriptionsApi } from '@/lib/api';
import { Subscription } from '@/types';
import Link from 'next/link';
import styles from './page.module.css';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';

/**
 * My Subscriptions Page
 * Lists all subscriptions for the current user
 */
export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Subscription | null>(null);
  const [busy, setBusy] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();

  const refresh = async () => {
    const data = await subscriptionsApi.getAll();
    setSubscriptions(data);
  };

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        await refresh();
      } catch (error) {
        console.error('Failed to fetch subscriptions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.titleRow}>
        <h1 className={styles.title}>My Subscriptions</h1>
        <Link href="/#membership" className={styles.primaryButton}>
          Browse Subscriptions
        </Link>
      </div>
      
      {subscriptions.length === 0 ? (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <svg 
            viewBox="0 0 400 400" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '120px', height: '120px', margin: '0 auto 2rem', display: 'block' }}
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier"> 
              <path d="M177.818 76.0347C193.128 62.879 219.565 56.3475 239.677 64.7699C304.609 91.9587 269.1 183.452 204.028 174.369C160.167 168.248 162.583 84.1728 196.691 69.8894" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M142.592 149C111.564 182.552 91.4488 286.487 107.863 329.195C109.631 333.784 114.081 334.831 117.45 331.31C155.592 308 201.533 267.999 236.81 234.342C238.48 232.748 240.596 232.585 242.747 232.858C243.34 233.617 243.261 234.425 243.183 235.222C241.916 248 241.311 272.377 240.996 285.219C240.708 296.882 239.477 308.533 239.564 320.225C239.585 323.115 239.284 329.44 239.564 332.31C239.78 334.509 244.215 335.724 243.183 338.048" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M142.71 148.845C142.007 152.51 148.963 167.717 151.144 170.81C169.028 196.155 189.4 232.596 223.701 236.643C226.813 237.01 229.933 235.319 232.977 236.992C233.683 237.382 234.488 236.478 235.107 235.976C237.021 234.424 238.895 232.819 240.285 230.783C241.588 228.877 242.709 226.899 245.782 227.905C248.761 228.883 250.756 230.562 250.968 233.665C251.089 235.434 251.085 237.181 251.929 238.814C267.165 268.244 280.722 296.267 291.172 327.626C292.39 331.283 294.472 333.263 298.883 332.765" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
            </g>
          </svg>
          <p>You don&apos;t have any subscriptions yet.</p>
          <Link
            href="/#membership"
            style={{
              display: 'inline-block',
              marginTop: '1.5rem',
              padding: '0.875rem 1.75rem',
              background: '#000',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '600',
              transition: 'background-color 0.2s',
              letterSpacing: '-0.2px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#000';
            }}
          >
            Browse Subscriptions
          </Link>
        </div>
      ) : (
        <div className={styles.grid}>
          {subscriptions.map((s) => {
            const statusClass =
              s.status === 'active'
                ? `${styles.statusPill} ${styles.statusActive}`
                : s.status === 'cancelled'
                  ? `${styles.statusPill} ${styles.statusCancelled}`
                  : styles.statusPill;
            const orderId = s.razorpaySubscriptionId || s.id;
            return (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardTop}>
                  {s.product?.imageUrl ? (
                    <img src={s.product.imageUrl} alt={s.product?.name || 'Product'} className={styles.image} />
                  ) : (
                    <div className={styles.image} />
                  )}
                  <div className={styles.meta}>
                    <h3 className={styles.productName}>{s.product?.name || 'Product'}</h3>
                    <p className={styles.subText}>Quantity: {s.litresPerDay}L/day</p>
                    <p className={styles.subText}>Order ID: {orderId}</p>
                    <p className={styles.subText}>Ends: {new Date(s.endDate).toLocaleDateString()}</p>
                    <div className={styles.statusRow}>
                      <span className={statusClass}>{s.status}</span>
                    </div>
                  </div>
                </div>
                <div className={styles.actions}>
                  <button className={styles.button} onClick={() => setSelected(s)}>
                    View Details
                  </button>
                  <button
                    className={`${styles.button} ${styles.primaryButton}`}
                    onClick={() => {
                      addItem({ productId: s.productId, quantity: 1 });
                      showToast('Added to cart', 'success');
                    }}
                  >
                    Buy This
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Subscription Details</h2>
              <button className={styles.closeButton} onClick={() => setSelected(null)} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Product</span>
                <span className={styles.detailValue}>{selected.product?.name || 'Product'}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Quantity</span>
                <span className={styles.detailValue}>{selected.litresPerDay}L/day</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Delivery Start</span>
                <span className={styles.detailValue}>{new Date(selected.startDate).toLocaleDateString()}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Expiry</span>
                <span className={styles.detailValue}>{new Date(selected.endDate).toLocaleDateString()}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Purchased/Renewed</span>
                <span className={styles.detailValue}>
                  {new Date(selected.purchasedAt || selected.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Delivery Time</span>
                <span className={styles.detailValue}>{selected.deliveryTime}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Total Paid</span>
                <span className={styles.detailValue}>
                  ₹{(selected.totalAmountPaid ?? selected.totalAmount ?? 0).toFixed(2)}
                </span>
              </div>
            </div>
            {(selected.status === 'active' || selected.status === 'paused') && (
              <div className={styles.modalActions}>
                <button
                  className={styles.secondaryButton}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      const updated = await subscriptionsApi.cancelToday(selected.id);
                      showToast("Today's delivery cancelled", 'success');
                      setSelected(updated);
                      await refresh();
                    } catch (e) {
                      showToast((e as { message?: string })?.message || 'Failed to cancel today', 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Cancel Today&apos;s Delivery
                </button>
                <button
                  className={styles.dangerButton}
                  disabled={busy}
                  onClick={async () => {
                    try {
                      setBusy(true);
                      const updated = await subscriptionsApi.cancel(selected.id);
                      showToast('Subscription cancelled', 'success');
                      setSelected(updated);
                      await refresh();
                    } catch (e) {
                      showToast((e as { message?: string })?.message || 'Failed to cancel subscription', 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Cancel Subscription
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
