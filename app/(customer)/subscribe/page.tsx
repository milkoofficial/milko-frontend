'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { productsApi, subscriptionsApi } from '@/lib/api';
import { Product } from '@/types';

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
  const [durationMonths, setDurationMonths] = useState(1);
  const [deliveryTime, setDeliveryTime] = useState('08:00');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Get pre-filled values from URL params
    const litersParam = searchParams.get('liters');
    const daysParam = searchParams.get('days');
    const monthsParam = searchParams.get('months');
    
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
        durationMonths,
        deliveryTime,
      });

      if (!result.razorpayOrder) {
        alert('Subscription activated using wallet.');
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
    <div style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>Subscribe to {product.name}</h1>
      <p style={{ marginTop: '0.5rem', color: '#666' }}>₹{product.pricePerLitre} per litre</p>

      <form onSubmit={handleSubmit} style={{ marginTop: '2rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Litres per day
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={litresPerDay}
            onChange={(e) => setLitresPerDay(Number(e.target.value))}
            required
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Duration (months)
          </label>
          <select
            value={durationMonths}
            onChange={(e) => setDurationMonths(Number(e.target.value))}
            required
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
          >
            <option value={1}>1 month</option>
            <option value={3}>3 months</option>
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
          </select>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
            Delivery Time
          </label>
          <input
            type="time"
            value={deliveryTime}
            onChange={(e) => setDeliveryTime(e.target.value)}
            required
            style={{ width: '100%', padding: '0.75rem', border: '1px solid #ddd', borderRadius: '4px' }}
          />
        </div>

        <div style={{ 
          padding: '1rem', 
          background: '#f5f5f5', 
          borderRadius: '4px', 
          marginBottom: '1.5rem' 
        }}>
          <p><strong>Total per day:</strong> ₹{product.pricePerLitre * litresPerDay}</p>
          <p><strong>Total for {durationMonths} month(s):</strong> ₹{product.pricePerLitre * litresPerDay * 30 * durationMonths}</p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            padding: '0.75rem',
            background: submitting ? '#ccc' : '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: submitting ? 'not-allowed' : 'pointer'
          }}
        >
          {submitting ? 'Processing...' : 'Proceed to Payment'}
        </button>
      </form>
    </div>
  );
}
