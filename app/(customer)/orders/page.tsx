'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * My Orders Page
 * Lists all orders for the current user
 */
export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // TODO: Replace with actual orders API when available
        // const data = await ordersApi.getAll();
        // setOrders(data);
        setOrders([]);
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>My Orders</h1>
      
      {orders.length === 0 ? (
        <div style={{ marginTop: '2rem', textAlign: 'center' }}>
          <svg 
            viewBox="0 0 400 400" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg"
            style={{ width: '120px', height: '120px', margin: '0 auto 2rem', display: 'block' }}
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier"> 
              <path d="M177.818 76.0347C193.128 62.879 219.565 56.3475 239.677 64.7699C304.609 91.9587 269.1 183.452 204.028 174.369C160.167 168.248 162.583 84.1728 196.691 69.8894" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M142.592 149C111.564 182.552 91.4488 286.487 107.863 329.195C109.631 333.784 114.081 334.831 117.45 331.31C155.592 308 201.533 267.999 236.81 234.342C238.48 232.748 240.596 232.585 242.747 232.858C243.34 233.617 243.261 234.425 243.183 235.222C241.916 248 241.311 272.377 240.996 285.219C240.708 296.882 239.477 308.533 239.564 320.225C239.585 323.115 239.284 329.44 239.564 332.31C239.78 334.509 244.215 335.724 243.183 338.048" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
              <path d="M142.71 148.845C142.007 152.51 148.963 167.717 151.144 170.81C169.028 196.155 189.4 232.596 223.701 236.643C226.813 237.01 229.933 235.319 232.977 236.992C233.683 237.382 234.488 236.478 235.107 235.976C237.021 234.424 238.895 232.819 240.285 230.783C241.588 228.877 242.709 226.899 245.782 227.905C248.761 228.883 250.756 230.562 250.968 233.665C251.089 235.434 251.085 237.181 251.929 238.814C267.165 268.244 280.722 296.267 291.172 327.626C292.39 331.283 294.472 333.263 298.883 332.765" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path> 
            </g>
          </svg>
          <p>You don&apos;t have any orders yet.</p>
          <Link 
            href="/products"
            style={{
              display: 'inline-block',
              marginTop: '1.5rem',
              padding: '0.875rem 1.75rem',
              background: '#000',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '600',
              transition: 'background-color 0.2s',
              letterSpacing: '-0.2px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#000';
            }}
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {orders.map((order) => (
            <div key={order.id} style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '1.5rem',
              background: '#fff'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <h3>Order #{order.id}</h3>
                  <p>Date: {new Date(order.createdAt).toLocaleDateString()}</p>
                  <p>Total: ₹{order.total}</p>
                  <p>Status: <strong>{order.status}</strong></p>
                </div>
                <div>
                  <Link 
                    href={`/orders/${order.id}`}
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
