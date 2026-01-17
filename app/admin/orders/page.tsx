'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import { useToast } from '@/contexts/ToastContext';

type AdminOrder = {
  orderId: string;
  orderNumber: string;
  orderedAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  amount: number | null;
  currency: string;
  paymentStatus: 'captured' | 'pending' | 'failed' | 'refunded' | string;
  itemsCount: number;
  deliveryStatus: 'pending' | 'delivered' | 'skipped' | 'cancelled' | string;
};

/**
 * Admin Orders Page
 * Shows paid orders only (captured payments).
 */
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const data = await apiClient.get<AdminOrder[]>('/api/admin/orders');
        setOrders(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
        setOrders([]);
        showToast((error as { message?: string })?.message || 'Failed to fetch orders', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [showToast]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', padding: '2rem' }}>
        <LoadingSpinnerWithText text="Loading orders..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 className={adminStyles.adminPageTitle}>Orders</h1>
      <p style={{ color: '#6b7280', marginTop: '0.4rem' }}>
        Showing paid orders only
      </p>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', marginTop: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Order#</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Date ordered</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Customer</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Amount</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Payment status</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Items</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Delivery status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.orderId} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '1rem', fontWeight: 700 }}>#{o.orderNumber}</td>
                <td style={{ padding: '1rem' }}>
                  {o.orderedAt ? new Date(o.orderedAt).toLocaleString() : '—'}
                </td>
                <td style={{ padding: '1rem' }}>
                  <div style={{ fontWeight: 700 }}>{o.customerName || '—'}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{o.customerEmail || ''}</div>
                </td>
                <td style={{ padding: '1rem' }}>
                  {o.amount === null ? '—' : `₹${o.amount.toFixed(2)}`}
                </td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '999px',
                    background: o.paymentStatus === 'captured' ? '#d4edda' : '#f8d7da',
                    color: o.paymentStatus === 'captured' ? '#155724' : '#721c24',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    display: 'inline-block'
                  }}>
                    {o.paymentStatus === 'captured' ? 'Paid' : o.paymentStatus}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>{o.itemsCount}</td>
                <td style={{ padding: '1rem' }}>{o.deliveryStatus || 'pending'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {orders.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No paid orders found.
          </div>
        )}
      </div>
    </div>
  );
}

