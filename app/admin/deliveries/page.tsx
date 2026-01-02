'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { API_ENDPOINTS } from '@/lib/utils/constants';
import { DeliverySchedule } from '@/types';

/**
 * Admin Deliveries Page
 * View and manage daily delivery schedules
 */
export default function AdminDeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliverySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    const fetchDeliveries = async () => {
      try {
        const data = await apiClient.get<DeliverySchedule[]>(
          `${API_ENDPOINTS.ADMIN.DELIVERIES.LIST}?date=${selectedDate}`
        );
        setDeliveries(data);
      } catch (error) {
        console.error('Failed to fetch deliveries:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveries();
  }, [selectedDate]);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Delivery Schedule</h1>

      <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem', fontWeight: 'bold' }}>Select Date:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
        />
      </div>

      <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Subscription ID</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Delivery Date</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '1rem' }}>{delivery.subscriptionId}</td>
                <td style={{ padding: '1rem' }}>{new Date(delivery.deliveryDate).toLocaleDateString()}</td>
                <td style={{ padding: '1rem' }}>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '12px',
                    background: delivery.status === 'delivered' ? '#d4edda' : delivery.status === 'pending' ? '#fff3cd' : '#f8d7da',
                    color: delivery.status === 'delivered' ? '#155724' : delivery.status === 'pending' ? '#856404' : '#721c24',
                    fontSize: '0.875rem'
                  }}>
                    {delivery.status}
                  </span>
                </td>
                <td style={{ padding: '1rem' }}>
                  {delivery.status === 'pending' && (
                    <button 
                      style={{ padding: '0.5rem 1rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Mark Delivered
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {deliveries.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No deliveries scheduled for this date.
          </div>
        )}
      </div>
    </div>
  );
}

