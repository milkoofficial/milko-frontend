'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { productsApi, subscriptionsApi } from '@/lib/api';
import { Product } from '@/types';
import styles from './SubscribePage.module.css';

/**
 * Subscribe Page
 * Allows customer to create a new subscription
 */
export default function SubscribePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const productId = searchParams.get('productId');

  const [product, setProduct] = useState<Product | null>(null);
  const [litresPerDay, setLitresPerDay] = useState(1);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('daily');
  const [durationMonths, setDurationMonths] = useState(1);
  const [deliveryTime, setDeliveryTime] = useState('08:00');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Get pre-filled values from URL params
    const litersParam = searchParams.get('liters');
    const daysParam = searchParams.get('days');
    const monthsParam = searchParams.get('months');
    const frequencyParam = searchParams.get('frequency');
    
    if (litersParam) {
      setLitresPerDay(parseFloat(litersParam));
    }
    if (monthsParam) {
      setDurationMonths(parseInt(monthsParam));
    } else if (daysParam) {
      // Convert days to months (approximate)
      const days = parseInt(daysParam);
      setDurationMonths(Math.ceil(days / 30));
    }

    if (
      frequencyParam === 'daily' ||
      frequencyParam === 'weekly' ||
      frequencyParam === 'monthly' ||
      frequencyParam === 'quarterly'
    ) {
      setFrequency(frequencyParam);
    }

    if (!productId) {
      router.push('/products');
      return;
    }

    const fetchProduct = async () => {
      try {
        const data = await productsApi.getById(productId);
        setProduct(data);
      } catch (error) {
        console.error('Failed to fetch product:', error);
        router.push('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) return;

    setSubmitting(true);
    let openedRazorpay = false;
    try {
      const result = await subscriptionsApi.create({
        productId,
        litresPerDay,
        frequency,
        durationMonths,
        deliveryTime,
      });

      if (!result.razorpayOrder) {
        if (result.subscription.status === 'active') {
          alert('Subscription activated using wallet.');
        } else {
          alert('Subscription created, but payment is unavailable (Razorpay not configured). Please recharge your wallet or try later.');
        }
        router.push('/subscriptions');
        return;
      }

      const loadRazorpayScript = (): Promise<void> => {
        if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
          return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.head.appendChild(s);
        });
      };

      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
      const rzp = new Razorpay({
        key: result.razorpayOrder.key,
        order_id: result.razorpayOrder.orderId,
        currency: result.razorpayOrder.currency || 'INR',
        name: 'Milko',
        description: 'Subscription payment',
        handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string }) {
          try {
            await subscriptionsApi.verifyPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
            });
            alert('Subscription activated!');
            router.push('/subscriptions');
          } catch (err) {
            console.error(err);
            alert('Payment verification failed. Please contact support.');
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
      openedRazorpay = true;
      rzp.open();
    } catch (error) {
      console.error('Failed to create subscription:', error);
      alert('Failed to create subscription. Please try again.');
    } finally {
      if (!openedRazorpay) setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!product) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Product not found</div>;
  }

  return (
    <div className={styles.pageWrap}>
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Subscribe to {product.name}</h1>
          <div className={styles.pricePill}>₹{product.pricePerLitre} per litre</div>
        </div>
        <p className={styles.subtitle}>Set your delivery plan below</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="frequency">
              Frequency
            </label>
            <div className={styles.controlWrap}>
              <select
                id="frequency"
                className={styles.select}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'quarterly')}
                required
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="litresPerDay">
              Litres per day
            </label>
            <input
              id="litresPerDay"
              className={styles.input}
              type="number"
              min="1"
              max="10"
              value={litresPerDay}
              onChange={(e) => setLitresPerDay(Number(e.target.value))}
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="durationMonths">
              Duration (months)
            </label>
            <div className={styles.controlWrap}>
              <select
                id="durationMonths"
                className={styles.select}
                value={durationMonths}
                onChange={(e) => setDurationMonths(Number(e.target.value))}
                required
              >
                <option value={1}>1 month</option>
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="deliveryTime">
              Delivery Time
            </label>
          <input
            id="deliveryTime"
            className={styles.input}
            type="time"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            required
          />
          </div>

          <div className={styles.totalsBox}>
            <p className={styles.totalLine}>
              Total per day: <strong>₹{product.pricePerLitre * litresPerDay}</strong>
            </p>
            <p className={styles.totalLine} style={{ marginTop: 8 }}>
              Total for {durationMonths} month(s):{' '}
              <strong>₹{product.pricePerLitre * litresPerDay * 30 * durationMonths}</strong>
            </p>
          </div>

          <button type="submit" disabled={submitting} className={styles.button}>
            {submitting ? 'Processing...' : 'Proceed to Payment'}
          </button>
        </form>
      </div>
    </div>
  );
}
