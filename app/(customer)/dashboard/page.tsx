'use client';

import { useEffect, useState } from 'react';
import { subscriptionsApi } from '@/lib/api';
import { Subscription } from '@/types';
import Link from 'next/link';

/**
 * Customer Dashboard
 * Shows user's active subscriptions and quick actions
 */
export default function DashboardPage() {
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

  const activeSubscriptions = subscriptions.filter(s => s.status === 'active');

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>My Dashboard</h1>
      
      {activeSubscriptions.length === 0 ? (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <p>You don&apos;t have any active subscriptions yet.</p>
          <Link 
            href="/products"
            style={{
              display: 'inline-block',
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              background: '#0070f3',
              color: 'white',
              borderRadius: '4px'
            }}
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div style={{ marginTop: '2rem' }}>
          <h2>Active Subscriptions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
            {activeSubscriptions.map((subscription) => (
              <div key={subscription.id} style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '8px', 
                padding: '1.5rem',
                background: '#fff'
              }}>
                <h3>{subscription.product?.name || 'Product'}</h3>
                <p>Quantity: {subscription.litresPerDay} litres/day</p>
                <p>Delivery Time: {subscription.deliveryTime}</p>
                <p>Status: {subscription.status}</p>
                <p>Valid until: {new Date(subscription.endDate).toLocaleDateString()}</p>
                <Link href={`/subscriptions/${subscription.id}`} style={{ color: '#0070f3' }}>
                  View Details
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

