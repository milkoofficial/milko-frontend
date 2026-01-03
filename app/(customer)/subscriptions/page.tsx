'use client';

import { useEffect, useState } from 'react';
import { subscriptionsApi } from '@/lib/api';
import { Subscription } from '@/types';
import Link from 'next/link';

/**
 * My Subscriptions Page
 * Lists all subscriptions for the current user
 */
export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const data = await subscriptionsApi.getAll();
        setSubscriptions(data);
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
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>My Subscriptions</h1>
      
      {subscriptions.length === 0 ? (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p>You don&apos;t have any subscriptions yet.</p>
          <Link href="/products">Browse Products</Link>
        </div>
      ) : (
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {subscriptions.map((subscription) => (
            <div key={subscription.id} style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '1.5rem',
              background: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3>{subscription.product?.name || 'Product'}</h3>
                  <p>Quantity: {subscription.litresPerDay} litres/day</p>
                  <p>Delivery Time: {subscription.deliveryTime}</p>
                  <p>Status: <strong>{subscription.status}</strong></p>
                  <p>Start: {new Date(subscription.startDate).toLocaleDateString()}</p>
                  <p>End: {new Date(subscription.endDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <Link 
                    href={`/subscriptions/${subscription.id}`}
                    style={{ color: '#0070f3' }}
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

