'use client';

import { useEffect, useState } from 'react';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

/**
 * Admin Customers Page
 * Customer analytics
 */
export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    orders: number;
    amountSpent: number;
    location: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await apiClient.get<{
          id: string;
          name: string;
          email: string;
          orders: number;
          amountSpent: number;
          location: string | null;
        }[]>('/api/admin/customers');
        setCustomers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch customers:', error);
        setCustomers([]);
        showToast((error as { message?: string })?.message || 'Failed to fetch customers', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [showToast]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading customers..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 className={adminStyles.adminPageTitle}>Customers</h1>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', marginTop: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Customer</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Email</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Orders</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Amount Spent</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Location</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '1rem' }}>{customer.name}</td>
                <td style={{ padding: '1rem' }}>{customer.email}</td>
                <td style={{ padding: '1rem' }}>{customer.orders}</td>
                <td style={{ padding: '1rem' }}>₹{(customer.amountSpent || 0).toFixed(2)}</td>
                <td style={{ padding: '1rem' }}>{customer.location || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No customers found.
          </div>
        )}
      </div>
    </div>
  );
}

