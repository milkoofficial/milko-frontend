'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import styles from './order-success.module.css';

export default function OrderSuccessPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [orderItems, setOrderItems] = useState<Array<{
    productId: string;
    variationId?: string;
    quantity: number;
    product: Product;
    variation?: any;
    price: number;
  }>>([]);
  const [deliveryAddress, setDeliveryAddress] = useState<any>(null);

  useEffect(() => {
    // Get order items from localStorage (saved before cart was cleared)
    const loadOrderData = async () => {
      try {
        // Get items from localStorage (saved before cart clear)
        const storedOrderItems = localStorage.getItem('milko_order_items');
        const storedItems = storedOrderItems ? JSON.parse(storedOrderItems) : [];
        
        if (storedItems.length === 0) {
          // If no items, redirect to home
          router.push('/');
          return;
        }

        // Load product details
        const unique: string[] = Array.from(new Set(storedItems.map((i: { productId: string }) => i.productId)));
        const entries = await Promise.all(
          unique.map(async (id: string) => {
            try {
              const p = await productsApi.getById(id, true);
              return [id, p] as const;
            } catch {
              return [id, null] as const;
            }
          })
        );
        
        const map: Record<string, Product> = {};
        for (const [id, p] of entries) {
          if (p) map[id] = p;
        }
        setProducts(map);

        // Build order items with product details
        const items = storedItems.map((item: { productId: string; variationId?: string; quantity: number }) => {
          const product = map[item.productId];
          if (!product) return null;
          
          const variation = item.variationId 
            ? (product.variations || []).find((v) => v.id === item.variationId)
            : null;
          const multiplier = variation?.priceMultiplier ?? 1;
          const price = product.pricePerLitre * multiplier;

          return {
            productId: item.productId,
            variationId: item.variationId,
            quantity: item.quantity,
            product,
            variation,
            price,
          };
        }).filter(Boolean) as any[];

        setOrderItems(items);

        // Get delivery address from localStorage if available
        const savedAddress = localStorage.getItem('milko_delivery_address');
        if (savedAddress) {
          try {
            setDeliveryAddress(JSON.parse(savedAddress));
          } catch (e) {
            console.error('Failed to parse saved address:', e);
          }
        }

        setLoading(false);
      } catch (error) {
        console.error('Failed to load order data:', error);
        router.push('/');
      }
    };

    loadOrderData();
  }, [router]);

  // Calculate totals
  const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryCharges = 0; // Free delivery
  const tax = subtotal * 0.08; // 8% tax (adjust as needed)
  const total = subtotal + deliveryCharges + tax;

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        {/* Success Icon and Message */}
        <div className={styles.successSection}>
          <div className={styles.successIcon}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
              <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
              <g id="SVGRepo_iconCarrier">
                <path fillRule="evenodd" clipRule="evenodd" d="M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12ZM16.0303 8.96967C16.3232 9.26256 16.3232 9.73744 16.0303 10.0303L11.0303 15.0303C10.7374 15.3232 10.2626 15.3232 9.96967 15.0303L7.96967 13.0303C7.67678 12.7374 7.67678 12.2626 7.96967 11.9697C8.26256 11.6768 8.73744 11.6768 9.03033 11.9697L10.5 13.4393L12.7348 11.2045L14.9697 8.96967C15.2626 8.67678 15.7374 8.67678 16.0303 8.96967Z" fill="#00a365"></path>
              </g>
            </svg>
          </div>
          <h1 className={styles.successTitle}>Thank you for your order!</h1>
          <p className={styles.successMessage}>Your order has been received and is being processed</p>
        </div>

        {/* Order Summary */}
        <div className={styles.orderSummarySection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>Order Summary</h2>
            <svg className={styles.caretIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          
          <div className={styles.itemsList}>
            {orderItems.map((item, index) => {
              const productImage = item.product.images?.[0]?.imageUrl || item.product.imageUrl;
              const variationText = item.variation ? `${item.variation.size}` : '';
              
              return (
                <div key={index} className={styles.orderItem}>
                  <div className={styles.itemImage}>
                    {productImage ? (
                      <Image
                        src={productImage}
                        alt={item.product.name}
                        width={60}
                        height={60}
                        style={{ objectFit: 'cover', borderRadius: '8px' }}
                      />
                    ) : (
                      <div className={styles.itemImagePlaceholder}>
                        <span>🥛</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemName}>{item.product.name}</h3>
                    {variationText && <p className={styles.itemVariant}>{variationText}</p>}
                    <p className={styles.itemQuantity}>Qty: {item.quantity}</p>
                  </div>
                  <div className={styles.itemPrice}>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.priceBreakdown}>
            <div className={styles.priceRow}>
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            <div className={styles.priceRow}>
              <span>Shipping</span>
              <span className={styles.freeShipping}>Free</span>
            </div>
            <div className={styles.priceRow}>
              <span>Tax</span>
              <span>₹{tax.toFixed(2)}</span>
            </div>
            <div className={styles.priceRowTotal}>
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Details */}
        {deliveryAddress && (
          <div className={styles.deliverySection}>
            <div className={styles.sectionHeader}>
              <svg className={styles.locationIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <h2 className={styles.sectionTitle}>Delivery Details</h2>
            </div>
            <div className={styles.deliveryContent}>
              <p className={styles.deliveryLabel}>Shipping to</p>
              <div className={styles.deliveryAddress}>
                <p>{deliveryAddress.name}</p>
                <p>{deliveryAddress.street}</p>
                <p>{deliveryAddress.city}, {deliveryAddress.state} {deliveryAddress.postalCode}</p>
                <p>{deliveryAddress.country}</p>
              </div>
              <div className={styles.shippingMethod}>
                <svg className={styles.truckIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 3H15V13H1V3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15 7H19L22 10V13H15V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="5" cy="17" r="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="19" cy="17" r="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Shipping method</span>
                <span className={styles.shippingMethodValue}>Standard Delivery</span>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <Link href="/orders" className={styles.viewOrdersButton}>
            View Orders
          </Link>
          <Link href="/" className={styles.continueShoppingButton}>
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
