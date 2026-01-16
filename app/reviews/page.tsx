'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { subscriptionsApi, productsApi } from '@/lib/api';
import { Subscription, Product } from '@/types';

interface PurchasedProduct {
  productId: string;
  product: Product;
  deliveredDate: string;
  orderId?: string;
  deliveryCharges: number;
  totalAmount: number;
}

/**
 * Reviews Page
 * Displays purchased products that can be reviewed
 */
export default function ReviewsPage() {
  const [purchasedProducts, setPurchasedProducts] = useState<PurchasedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPurchasedProducts = async () => {
      try {
        // Fetch user's subscriptions (which represent purchases)
        const subscriptions = await subscriptionsApi.getAll();
        
        // Filter only active subscriptions
        const activeSubscriptions = subscriptions.filter(
          sub => sub.status === 'active'
        );

        // Fetch product details and create purchased products list
        const productsList: PurchasedProduct[] = [];
        
        for (const subscription of activeSubscriptions) {
          try {
            const product = await productsApi.getById(subscription.productId, true);
            
            // Calculate delivery date (use subscription start date or first delivery date)
            const deliveredDate = subscription.startDate 
              ? new Date(subscription.startDate).toLocaleDateString('en-IN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              : 'N/A';

            // Calculate total amount (price per litre * litres per day * days)
            const daysInDuration = subscription.durationMonths * 30;
            const totalAmount = product.pricePerLitre * subscription.litresPerDay * daysInDuration;
            const deliveryCharges = 0; // Free delivery

            productsList.push({
              productId: product.id,
              product,
              deliveredDate,
              orderId: subscription.id,
              deliveryCharges,
              totalAmount
            });
          } catch (error) {
            console.error(`Failed to fetch product ${subscription.productId}:`, error);
          }
        }

        setPurchasedProducts(productsList);
      } catch (error) {
        console.error('Failed to fetch purchased products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPurchasedProducts();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>My Reviews</h1>
      
      {purchasedProducts.length === 0 ? (
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
              <path 
                d="M168.958 155.927C176.737 130.329 183.098 111.177 188.041 98.4702C195.455 79.4104 212.356 53.1502 212.356 60.1603C212.356 67.1705 239.365 153.837 243.921 155.927C248.477 158.016 327.888 156.593 326.992 160.124C326.097 163.655 327.188 164.541 317.314 170.331C310.732 174.19 287.62 191.086 247.979 221.017C245.644 221.991 245.882 224.949 248.692 229.891C252.907 237.304 265.034 277.871 269.41 290.528C273.786 303.186 282.717 337.149 278.251 340.628C273.786 344.108 252.431 322.129 247.979 317.222C243.527 312.314 212.356 253.79 204.271 253.79C196.186 253.79 178.108 279.57 174.148 284.216C170.187 288.862 128.921 336.672 114.124 338.65C99.3259 340.628 104.105 328.539 114.124 309.534C120.803 296.863 134.107 267.309 154.037 220.87C144.027 216.395 135.15 212.906 127.406 210.401C115.791 206.644 79.1085 194.473 73.9807 192.933C68.8528 191.392 84.9287 184.462 96.8396 177.396C108.751 170.331 135.032 160.124 149.953 160.124" 
                stroke="#000000" 
                strokeOpacity="0.9" 
                strokeWidth="16" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              ></path> 
            </g>
          </svg>
          <p>You don&apos;t have any reviews yet.</p>
          <p style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>Shop to review</p>
          <Link 
            href="/products"
            style={{
              display: 'inline-block',
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
        <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {purchasedProducts.map((item) => (
            <div 
              key={item.productId} 
              style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '8px', 
                padding: '1.5rem',
                background: '#fff',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-start'
              }}
            >
              {/* Product Image */}
              <div style={{ flexShrink: 0 }}>
                {item.product.imageUrl ? (
                  <Image
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    width={120}
                    height={120}
                    style={{ 
                      objectFit: 'cover', 
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0'
                    }}
                  />
                ) : (
                  <div style={{
                    width: '120px',
                    height: '120px',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid #e0e0e0'
                  }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 16L8.586 11.414C9.367 10.633 10.633 10.633 11.414 11.414L16 16M14 14L15.586 12.414C16.367 11.633 17.633 11.633 18.414 12.414L20 14M14 8H14.01M6 20H18C19.105 20 20 19.105 20 18V6C20 4.895 19.105 4 18 4H6C4.895 4 4 4.895 4 6V18C4 19.105 4.895 20 6 20Z" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Product Details */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#000' }}>
                  {item.product.name}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', color: '#666', fontSize: '0.95rem' }}>
                  <div>
                    <strong>Product Rate:</strong> ₹{item.product.pricePerLitre.toFixed(2)} per litre
                  </div>
                  <div>
                    <strong>Delivery Charges:</strong> {item.deliveryCharges === 0 ? 'Free' : `₹${item.deliveryCharges.toFixed(2)}`}
                  </div>
                  <div>
                    <strong>Delivered on:</strong> {item.deliveredDate}
                  </div>
                </div>

                {/* Write Review Button */}
                <div style={{ marginTop: '0.5rem' }}>
                  <button
                    onClick={() => {
                      // TODO: Open review modal or navigate to review form
                      alert(`Write review for ${item.product.name}`);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#000',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      fontWeight: '600',
                      cursor: 'pointer',
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
                    Write a Review
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
