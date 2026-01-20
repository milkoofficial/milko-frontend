'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import { useToast } from '@/contexts/ToastContext';

type OrderItem = {
  productName: string;
  variationSize: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  productId: number | null;
  imageUrl: string | null;
};

type AdminOrder = {
  orderId: string;
  orderNumber: string;
  orderedAt: string | null;
  customerName: string | null;
  customerEmail: string | null;
  amount: number | null;
  currency: string;
  paymentMethod?: string;
  paymentStatus: 'captured' | 'pending' | 'failed' | 'refunded' | string;
  itemsCount: number;
  deliveryStatus: 'pending' | 'package_prepared' | 'out_for_delivery' | 'delivered' | 'cancelled' | 'refunded' | string;
  fulfilledAt?: string | null;
};

type OrderDetails = {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  currency: string;
  subtotal: number;
  discount: number;
  deliveryCharges: number;
  total: number;
  deliveryAddress: any;
  createdAt: string;
  deliveryDate: string | null;
  customer: {
    name: string;
    email: string;
  };
  items: OrderItem[];
};

/**
 * Admin Orders Page
 * Shows paid orders only (captured payments).
 */
export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { showToast } = useToast();

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

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  const handleOrderClick = async (orderId: string) => {
    setLoadingDetails(true);
    setShowModal(true);
    try {
      const data = await apiClient.get<OrderDetails>(`/api/admin/orders/${orderId}`);
      setSelectedOrder(data);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      showToast('Failed to load order details', 'error');
      setShowModal(false);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleMarkAsPackagePrepared = async () => {
    if (!selectedOrder) return;
    try {
      await apiClient.post(`/api/admin/orders/${selectedOrder.id}/mark-package-prepared`);
      showToast('Order marked as package prepared successfully', 'success');
      setShowConfirmation(false);
      setShowModal(false);
      fetchOrders(); // Refresh the orders list
    } catch (error) {
      console.error('Failed to mark order:', error);
      showToast('Failed to update order status', 'error');
    }
  };

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

      <div style={{ background: 'white', borderRadius: '12px', overflow: 'hidden', marginTop: '1.5rem', border: '1px solid #ddd' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Order#</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Date ordered</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Customer</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Amount</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Payment status</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Items</th>
              <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0', fontSize: '0.85rem', letterSpacing: '0.02em', color: '#475569', fontWeight: 700 }}>Delivery status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => {
              const isFulfilled = o.deliveryStatus === 'delivered' && o.fulfilledAt;
              return (
              <tr 
                key={o.orderId} 
                onClick={() => handleOrderClick(o.orderId)}
                style={{ 
                  borderBottom: '1px solid #e0e0e0', 
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                  background: isFulfilled ? '#e5e7eb' : undefined
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = isFulfilled ? '#d1d5db' : '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.background = isFulfilled ? '#e5e7eb' : 'transparent'}
              >
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
                  {String(o.paymentMethod || '').toLowerCase() === 'cod' ? (
                    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.15rem' }}>
                      <span style={{
                        padding: '0.25rem 0.6rem',
                        borderRadius: '999px',
                        background: String(o.paymentStatus || '').toLowerCase() === 'paid' ? '#d4edda' : '#fef3c7',
                        color: String(o.paymentStatus || '').toLowerCase() === 'paid' ? '#155724' : '#92400e',
                        fontSize: '0.85rem',
                        fontWeight: 800,
                        display: 'inline-block'
                      }}>
                        COD
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 800 }}>
                        {String(o.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </div>
                  ) : (
                    <span style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '999px',
                      background: o.paymentStatus === 'captured' || String(o.paymentStatus || '').toLowerCase() === 'paid' ? '#d4edda' : '#f8d7da',
                      color: o.paymentStatus === 'captured' || String(o.paymentStatus || '').toLowerCase() === 'paid' ? '#155724' : '#721c24',
                      fontSize: '0.85rem',
                      fontWeight: 800,
                      display: 'inline-block'
                    }}>
                      {o.paymentStatus === 'captured' || String(o.paymentStatus || '').toLowerCase() === 'paid' ? 'Paid' : o.paymentStatus}
                    </span>
                  )}
                </td>
                <td style={{ padding: '1rem' }}>{o.itemsCount}</td>
                <td style={{ padding: '1rem' }}>{o.deliveryStatus || 'pending'}</td>
              </tr>
            );})}
          </tbody>
        </table>

        {orders.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
            No paid orders found.
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            {/* Close button */}
            <button
              onClick={() => setShowModal(false)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: '#666',
                padding: '0.5rem',
                lineHeight: 1
              }}
            >
              ×
            </button>

            {loadingDetails ? (
              <div style={{ padding: '3rem', textAlign: 'center' }}>
                <LoadingSpinnerWithText text="Loading order details..." />
              </div>
            ) : selectedOrder ? (
              <div style={{ padding: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Order #{selectedOrder.orderNumber}
                </h2>
                <p style={{ color: '#666', marginBottom: '2rem' }}>
                  {selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : ''}
                </p>

                {/* Customer Info */}
                <section style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#374151' }}>
                    Customer Information
                  </h3>
                  <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ margin: '0.25rem 0', fontWeight: 600 }}>{selectedOrder.customer.name}</p>
                    <p style={{ margin: '0.25rem 0', color: '#666' }}>{selectedOrder.customer.email}</p>
                  </div>
                </section>

                {/* Delivery Address */}
                <section style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#374151' }}>
                    Delivery Address
                  </h3>
                  <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
                    {selectedOrder.deliveryAddress && (
                      <>
                        <p style={{ margin: '0.25rem 0' }}>{selectedOrder.deliveryAddress.name || ''}</p>
                        <p style={{ margin: '0.25rem 0' }}>{selectedOrder.deliveryAddress.street || ''}</p>
                        <p style={{ margin: '0.25rem 0' }}>
                          {[selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.state, selectedOrder.deliveryAddress.postalCode].filter(Boolean).join(', ')}
                        </p>
                        {selectedOrder.deliveryAddress.phone && (
                          <p style={{ margin: '0.25rem 0' }}>Phone: {selectedOrder.deliveryAddress.phone}</p>
                        )}
                      </>
                    )}
                  </div>
                </section>

                {/* Order Items */}
                <section style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#374151' }}>
                    Order Items ({selectedOrder.items.length})
                  </h3>
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      gap: '1rem',
                      padding: '1rem',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      marginBottom: '0.5rem'
                    }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        background: '#e5e7eb',
                        overflow: 'hidden',
                        flexShrink: 0
                      }}>
                        {item.imageUrl && <img src={item.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontWeight: 600, margin: '0 0 0.25rem 0' }}>{item.productName}</p>
                        {item.variationSize && (
                          <p style={{ fontSize: '0.875rem', color: '#666', margin: '0 0 0.25rem 0' }}>{item.variationSize}</p>
                        )}
                        <p style={{ fontSize: '0.875rem', color: '#666', margin: 0 }}>Qty: {item.quantity} × ₹{item.unitPrice.toFixed(2)}</p>
                      </div>
                      <div style={{ fontWeight: 700 }}>₹{item.lineTotal.toFixed(2)}</div>
                    </div>
                  ))}
                </section>

                {/* Order Summary */}
                <section style={{ marginBottom: '2rem' }}>
                  <div style={{ borderTop: '2px solid #e5e7eb', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5rem 0' }}>
                      <span>Subtotal:</span>
                      <span>₹{selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5rem 0', color: '#059669' }}>
                        <span>Discount:</span>
                        <span>-₹{selectedOrder.discount.toFixed(2)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '0.5rem 0' }}>
                      <span>Delivery Charges:</span>
                      <span>{selectedOrder.deliveryCharges === 0 ? 'FREE' : `₹${selectedOrder.deliveryCharges.toFixed(2)}`}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', margin: '1rem 0 0 0', fontSize: '1.25rem', fontWeight: 700 }}>
                      <span>Total:</span>
                      <span>₹{selectedOrder.total.toFixed(2)}</span>
                    </div>
                  </div>
                </section>

                {/* Action Buttons */}
                {selectedOrder.status === 'placed' && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button
                      onClick={() => setShowConfirmation(true)}
                      style={{
                        flex: 1,
                        padding: '0.875rem',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.95rem'
                      }}
                    >
                      Mark as Package Prepared
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          padding: '1rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '2rem',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
              Confirm Action
            </h3>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              Are you sure you want to mark this order as package prepared? This will create a delivery entry and update the customer&apos;s order timeline.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowConfirmation(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#f3f4f6',
                  color: '#374151',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleMarkAsPackagePrepared}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Yes, Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

