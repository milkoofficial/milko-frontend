'use client';

import { useEffect, useState } from 'react';
import { adminSubscriptionsApi } from '@/lib/api';
import { Subscription } from '@/types';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';

/**
 * Admin Subscriptions Page
 * View and manage all subscriptions
 */
export default function AdminSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptions = async () => {
      try {
        const data = await adminSubscriptionsApi.getAll();
        setSubscriptions(data);
      } catch (error) {
        console.error('Failed to fetch subscriptions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptions();
  }, []);

  const handlePause = async (id: string) => {
    try {
      await adminSubscriptionsApi.pause(id);
      // Refresh list
      const data = await adminSubscriptionsApi.getAll();
      setSubscriptions(data);
    } catch (error) {
      console.error('Failed to pause subscription:', error);
      alert('Failed to pause subscription');
    }
  };

  const handleResume = async (id: string) => {
    try {
      await adminSubscriptionsApi.resume(id);
      // Refresh list
      const data = await adminSubscriptionsApi.getAll();
      setSubscriptions(data);
    } catch (error) {
      console.error('Failed to resume subscription:', error);
      alert('Failed to resume subscription');
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading memberships..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 className={adminStyles.adminPageTitle}>Subscriptions</h1>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', marginTop: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Product</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Customer</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Quantity</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((subscription) => (
              <tr key={subscription.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '1rem' }}>{subscription.product?.name || 'N/A'}</td>
                <td style={{ padding: '1rem' }}>User ID: {subscription.userId}</td>
                <td style={{ padding: '1rem' }}>{subscription.litresPerDay}L/day</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    background: subscription.status === 'active' ? '#d4edda' : '#f8d7da',
                    color: subscription.status === 'active' ? '#155724' : '#721c24',
                    fontSize: '0.875rem'
                  }}>
                    {subscription.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {subscription.status === 'active' ? (
                    <button 
                      onClick={() => handlePause(subscription.id)}
                      style={{ padding: '0.5rem 1rem', background: '#ffc107', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '0.5rem' }}
                    >
                      Pause
                    </button>
                  ) : subscription.status === 'paused' ? (
                    <button 
                      onClick={() => handleResume(subscription.id)}
                      style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Resume
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscriptions.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No subscriptions found.
          </div>
        )}
      </div>
    </div>
  );
}

