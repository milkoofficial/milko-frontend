'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { User } from '@/types';

/**
 * Admin Customers Page
 * View all customers
 */
export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await apiClient.get<User[]>(API_ENDPOINTS.ADMIN.USERS.LIST);
        setCustomers(data);
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Customers</h1>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', marginTop: '2rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Name</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Email</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Role</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Joined</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '1rem' }}>{customer.name}</td>
                <td style={{ padding: '1rem' }}>{customer.email}</td>
                <td style={{ padding: '1rem' }}>{customer.role}</td>
                <td style={{ padding: '1rem' }}>{new Date(customer.createdAt).toLocaleDateString()}</td>
                <td style={{ padding: '1rem' }}>
                  <Link href={`/admin/customers/${customer.id}`} style={{ color: '#0070f3' }}>
                    View Details
                  </Link>
                </td>
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

