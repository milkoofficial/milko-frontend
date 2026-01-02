'use client';

import Link from 'next/link';

/**
 * Admin Dashboard
 * Overview of key metrics and quick actions
 */
export default function AdminDashboard() {
  return (
    <div style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Admin Dashboard</h1>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginTop: '2rem'
      }}>
        <Link href="/admin/products" style={{
          padding: '2rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2>Manage Products</h2>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>Add, edit, or deactivate products</p>
        </Link>

        <Link href="/admin/customers" style={{
          padding: '2rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2>View Customers</h2>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>Manage customer accounts</p>
        </Link>

        <Link href="/admin/subscriptions" style={{
          padding: '2rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2>Subscriptions</h2>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>View and manage subscriptions</p>
        </Link>

        <Link href="/admin/deliveries" style={{
          padding: '2rem',
          background: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <h2>Delivery Schedule</h2>
          <p style={{ color: '#666', marginTop: '0.5rem' }}>Manage daily deliveries</p>
        </Link>
      </div>
    </div>
  );
}

