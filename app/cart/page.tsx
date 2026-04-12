'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  readSubscriptionCartJson,
  clearSubscriptionCart,
  scopedSubscriptionCartKey,
} from '@/lib/utils/userScopedStorage';
import { productsApi, couponsApi } from '@/lib/api';
import type { Coupon } from '@/lib/api';
import { Product } from '@/types';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import { saveCheckoutCouponCode } from '@/lib/utils/checkoutCoupon';
import styles from './cart.module.css';

type SubscriptionCartItem = {
  type: 'subscription';
  productId: string;
  productName: string;
  litresPerDay: number;
  durationMonths: number;
  durationDays?: number;
  deliveryTime: string;
  totalAmount: number;
  updatedAt: string;
};

export default function CartPage() {
  const router = useRouter();
  const { user } = useAuth();
  const subCartUserId = user?.id ?? null;
  const { items, setItemQuantity, removeItem } = useCart();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [appliedCouponData, setAppliedCouponData] = useState<Coupon | null>(null);
  const [couponValidationStatus, setCouponValidationStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [subscriptionCartItem, setSubscriptionCartItem] = useState<SubscriptionCartItem | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const unique = Array.from(new Set(items.map((i) => i.productId)));
      const entries = await Promise.all(
        unique.map(async (id) => {
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
    };
    if (items.length) load();
  }, [items]);

  useEffect(() => {
    const loadSubscriptionItem = () => {
      try {
        const raw = readSubscriptionCartJson(subCartUserId);
        if (!raw) {
          setSubscriptionCartItem(null);
          return;
        }
        const parsed = JSON.parse(raw) as Partial<SubscriptionCartItem>;
        const hasDuration =
          (typeof parsed.durationDays === 'number' && parsed.durationDays >= 1) ||
          (typeof parsed.durationMonths === 'number' && parsed.durationMonths >= 1);
        if (
          parsed
          && parsed.type === 'subscription'
          && typeof parsed.productId === 'string'
          && typeof parsed.productName === 'string'
          && typeof parsed.litresPerDay === 'number'
          && hasDuration
          && typeof parsed.deliveryTime === 'string'
          && typeof parsed.totalAmount === 'number'
        ) {
          setSubscriptionCartItem(parsed as SubscriptionCartItem);
        } else {
          setSubscriptionCartItem(null);
        }
      } catch {
        setSubscriptionCartItem(null);
      }
    };
    loadSubscriptionItem();
    const onStorage = (e: StorageEvent) => {
      if (e.key === scopedSubscriptionCartKey(subCartUserId) || e.key === 'milko_subscription_cart_item_v1') {
        loadSubscriptionItem();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [subCartUserId]);

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getItemKey = (productId: string, variationId?: string) => {
    return `${productId}:${variationId || ''}`;
  };


  const handleQuantityChange = (productId: string, variationId: string | undefined, delta: number) => {
    const item = items.find(it => it.productId === productId && it.variationId === variationId);
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      setItemQuantity(productId, newQuantity, variationId);
    }
  };


  /** Same basis as checkout `itemsSubtotal` + subscription — coupons and totals match checkout. */
  const subtotalAlignedWithCheckout = useMemo(() => {
    const itemsPart = items.reduce((sum, it) => {
      const p = products[it.productId];
      if (!p) return sum;
      const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
      const basePrice =
        p.sellingPrice !== null && p.sellingPrice !== undefined ? p.sellingPrice : p.pricePerLitre;
      const mult = v?.priceMultiplier ?? 1;
      const unitPrice = v?.price ?? basePrice * mult;
      return sum + unitPrice * it.quantity;
    }, 0);
    return itemsPart + (subscriptionCartItem?.totalAmount ?? 0);
  }, [items, products, subscriptionCartItem]);

  // Your total savings = sum of (compareAtPrice - sellingPrice) * mult * qty per item
  const savings = useMemo(() => {
    return items.reduce((sum, it) => {
      const p = products[it.productId];
      if (!p) return sum;
      const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
      const mult = v?.priceMultiplier ?? 1;
      const compare = (p.compareAtPrice != null && p.compareAtPrice !== undefined) ? p.compareAtPrice : p.pricePerLitre;
      const selling = (p.sellingPrice != null && p.sellingPrice !== undefined) ? p.sellingPrice : p.pricePerLitre;
      const perUnit = Math.max(0, compare - selling);
      return sum + perUnit * mult * it.quantity;
    }, 0);
  }, [items, products]);

  // Coupon discount from applied coupon
  const couponDiscount = useMemo(() => {
    if (!appliedCouponData) return 0;
    const c = appliedCouponData;
    let d = 0;
    if (c.discountType === 'percentage') {
      d = (subtotalAlignedWithCheckout * c.discountValue) / 100;
      if (c.maxDiscountAmount != null && d > c.maxDiscountAmount) d = c.maxDiscountAmount;
    } else {
      d = c.discountValue;
    }
    return Math.min(d, subtotalAlignedWithCheckout);
  }, [appliedCouponData, subtotalAlignedWithCheckout]);

  const deliveryCharges = items.length > 0 ? 0 : 0; // Free delivery
  const total = subtotalAlignedWithCheckout - couponDiscount + deliveryCharges;
  const totalItemCount = items.length + (subscriptionCartItem ? 1 : 0);

  const handleSelectMembership = () => {
    const firstProductId = items[0]?.productId || subscriptionCartItem?.productId;
    const next = new URLSearchParams();
    next.set('from', 'cart');
    if (firstProductId) next.set('productId', firstProductId);
    if (subscriptionCartItem) {
      next.set('liters', String(subscriptionCartItem.litresPerDay));
      if (subscriptionCartItem.durationDays != null && subscriptionCartItem.durationDays >= 1) {
        next.set('days', String(subscriptionCartItem.durationDays));
      } else {
        next.set('months', String(subscriptionCartItem.durationMonths));
      }
    }
    router.push(`/subscribe?${next.toString()}`);
  };

  const handleRemoveSubscriptionCartItem = () => {
    clearSubscriptionCart(subCartUserId);
    setSubscriptionCartItem(null);
  };

  const handleApplyCoupon = async () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    setValidatingCoupon(true);
    setCouponValidationStatus('idle');
    try {
      const coupon = await couponsApi.validate(code, subtotalAlignedWithCheckout);
      setAppliedCoupon(code);
      setAppliedCouponData(coupon);
      setCouponValidationStatus('valid');
      saveCheckoutCouponCode(code);
    } catch {
      setCouponValidationStatus('invalid');
      setAppliedCoupon(null);
      setAppliedCouponData(null);
      saveCheckoutCouponCode(null);
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setAppliedCouponData(null);
    setCouponCode('');
    setCouponValidationStatus('idle');
    saveCheckoutCouponCode(null);
  };

  useEffect(() => {
    if (!couponCode.trim()) setCouponValidationStatus('idle');
  }, [couponCode]);

  const handleCheckout = () => {
    if (items.length === 0) {
      alert('Please add at least one item to checkout');
      return;
    }
    // Navigate to checkout page using Next.js router to preserve state
    router.push('/checkout');
  };

  if (items.length === 0 && !subscriptionCartItem) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyCart}>
          <svg
            viewBox="0 0 400 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={styles.emptyCartIcon}
          >
            <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
            <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
            <g id="SVGRepo_iconCarrier">
              <path d="M269.824 261.753C246.209 228.062 203.138 282.309 233.404 304.514C256.923 321.77 284.534 294.874 273.492 271.471" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M252.318 221.946C248.159 130.522 192.256 79 101.382 79" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M221.698 142.794C214.564 147.712 206.557 151.319 200.029 157.146C125.176 223.994 110.888 147.382 86.2657 206.588" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M252.318 221.946C349.522 252.45 296.046 294.219 314.735 320" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
              <path d="M248.785 221.978C106.971 219.909 227.399 321.76 174.591 319.978" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
            </g>
          </svg>
          <h1 className={styles.emptyCartText}>Your cart is empty</h1>
          <p className={styles.emptyCartTagline}>This cart deserves better.</p>
          <Link href="/" className={styles.continueShoppingButton}>
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Progress Bar */}
      <div className={styles.progressBar}>
        <div className={`${styles.progressStep} ${styles.progressStepActive}`}>
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Cart</span>
        </div>
        <div className={styles.progressStep}>
          <span className={styles.stepNumber}>2</span>
          <span className={styles.stepLabel}>Address</span>
        </div>
        <div className={styles.progressStep}>
          <span className={styles.stepNumber}>3</span>
          <span className={styles.stepLabel}>Payment</span>
        </div>
      </div>

      <div className={styles.cartLayout}>
        {/* Left Column - Cart Items */}
        <div className={styles.cartItemsColumn}>
          {/* Item Count */}
          <div className={styles.selectionSummary}>
            <span className={styles.itemCount}>{totalItemCount} item{totalItemCount !== 1 ? 's' : ''} in cart</span>
          </div>

          {/* Items List */}
          <div className={styles.itemsList}>
            {items.map((it) => {
              const p = products[it.productId];
              const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
              const itemKey = getItemKey(it.productId, it.variationId);
              const mult = v?.priceMultiplier ?? 1;
              const basePrice =
                p && (p.sellingPrice !== null && p.sellingPrice !== undefined)
                  ? p.sellingPrice
                  : p?.pricePerLitre ?? 0;
              const price = p ? (v?.price ?? basePrice * mult) : 0;
              const itemTotal = price * it.quantity;
              const productImage = p?.images?.[0]?.imageUrl || p?.imageUrl || '/placeholder-product.png';

              const handleProductClick = async () => {
                if (p) {
                  try {
                    // Fetch full product details
                    const fullProduct = await productsApi.getById(p.id, true);
                    setSelectedProduct(fullProduct);
                    setIsProductModalOpen(true);
                  } catch (error) {
                    console.error('Failed to fetch product details:', error);
                  }
                }
              };

              return (
                <div key={itemKey} className={styles.cartItem}>
                  <div 
                    className={styles.itemImage}
                    onClick={handleProductClick}
                    style={{ cursor: 'pointer' }}
                  >
                    {p && productImage && productImage !== '/placeholder-product.png' ? (
                      <Image
                        src={productImage}
                        alt={p.name}
                        width={100}
                        height={100}
                        style={{ objectFit: 'cover', borderRadius: '8px' }}
                      />
                    ) : (
                      <div className={styles.itemImagePlaceholder}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M4 16L8.586 11.414C9.367 10.633 10.633 10.633 11.414 11.414L16 16M14 14L15.586 12.414C16.367 11.633 17.633 11.633 18.414 12.414L20 14M14 8H14.01M6 20H18C19.105 20 20 19.105 20 18V6C20 4.895 19.105 4 18 4H6C4.895 4 4 4.895 4 6V18C4 19.105 4.895 20 6 20Z" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </div>

                  <div 
                    className={styles.itemDetails}
                    onClick={handleProductClick}
                    style={{ cursor: 'pointer' }}
                  >
                    <h3 className={styles.itemTitle}>{p ? p.name : 'Loading...'}</h3>
                    <div className={styles.itemInfo}>
                      {v && <span>{v.size}</span>}
                      <span>Fresh milk</span>
                      <span>Express delivery in 1 Hour</span>
                    </div>
                    <div className={styles.itemPrice}>₹{price.toFixed(2)}</div>
                  </div>

                  <div className={styles.itemActions}>
                    <div className={styles.quantitySelector}>
                      <button
                        onClick={() => handleQuantityChange(it.productId, it.variationId, -1)}
                        className={styles.quantityButton}
                        disabled={it.quantity <= 1}
                      >
                        −
                      </button>
                      <span className={styles.quantityValue}>{it.quantity}</span>
                      <button
                        onClick={() => handleQuantityChange(it.productId, it.variationId, 1)}
                        className={styles.quantityButton}
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(it.productId, it.variationId)}
                      className={styles.removeButton}
                      aria-label="Remove item"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
            {subscriptionCartItem && (
              <div className={styles.cartItem}>
                <div className={styles.itemImage}>
                  <div className={styles.itemImagePlaceholder}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M5 16L3 5L8.5 10L12 8L15.5 10L21 5L19 16H5Z" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 16H21" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                <div className={styles.itemDetails}>
                  <h3 className={styles.itemTitle}>Subscription for {subscriptionCartItem.productName}</h3>
                  <p className={styles.subscriptionTransferNote}>
                    Subscriptions are transferred in My Account &gt;{' '}
                    <Link href="/subscriptions" className={styles.subscriptionTransferLink}>
                      Subscriptions
                    </Link>
                  </p>
                  <div className={styles.itemInfo}>
                    <span>Qty: {subscriptionCartItem.litresPerDay} L/day</span>
                    <span>
                      Period:{' '}
                      {subscriptionCartItem.durationDays != null && subscriptionCartItem.durationDays >= 1
                        ? `${subscriptionCartItem.durationDays} day(s)`
                        : `${subscriptionCartItem.durationMonths} month(s)`}
                    </span>
                    <span>Delivery: {subscriptionCartItem.deliveryTime}</span>
                  </div>
                  <div className={styles.itemPrice}>₹{subscriptionCartItem.totalAmount.toFixed(2)}</div>
                </div>
                <div className={styles.itemActions}>
                  <button
                    onClick={handleRemoveSubscriptionCartItem}
                    className={styles.removeButton}
                    aria-label="Remove subscription"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Summary */}
        <div className={styles.summaryColumn}>
          {/* Coupons */}
          <div className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>Coupons</h3>
            {appliedCoupon ? (
              <div className={styles.appliedCoupon}>
                <span className={styles.couponCode}>{appliedCoupon}</span>
                <button onClick={handleRemoveCoupon} className={styles.removeCouponButton}>×</button>
              </div>
            ) : (
              <div className={styles.couponInputContainer}>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className={`${styles.couponInput} ${couponValidationStatus === 'valid' ? styles.couponInputValid : ''} ${couponValidationStatus === 'invalid' ? styles.couponInputInvalid : ''} ${couponValidationStatus === 'invalid' ? styles.couponInputShake : ''}`}
                  onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                  disabled={validatingCoupon}
                />
                <button
                  onClick={() => handleApplyCoupon()}
                  className={styles.applyCouponButton}
                  disabled={!couponCode.trim() || validatingCoupon}
                >
                  {validatingCoupon ? '...' : 'Apply'}
                </button>
              </div>
            )}
          </div>

          {/* Subscription */}
          <div className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>Subscription</h3>
            <div className={styles.subscriptionBox}>
              <div className={styles.subscriptionContent}>
                <p className={styles.subscriptionQuestion}>Get exclusive benefits!</p>
                <p className={styles.subscriptionText}>
                  {subscriptionCartItem
                    ? `Subscription for ${subscriptionCartItem.productName}`
                    : 'Choose a membership plan to save more'}
                </p>
                <button
                  onClick={handleSelectMembership}
                  className={styles.addSubscriptionLink}
                >
                  {subscriptionCartItem ? 'Change subscription' : 'Select membership'}
                </button>
              </div>
              <div className={styles.subscriptionIcon}>
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 16L3 5L8.5 10L12 8L15.5 10L21 5L19 16H5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 16H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Price Details */}
          <div className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>Price Details</h3>
              <div className={styles.priceDetailsBox}>
              <div className={styles.priceRow}>
                <span>{totalItemCount} item{totalItemCount !== 1 ? 's' : ''}</span>
              </div>
              {items.map((it) => {
                const p = products[it.productId];
                const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
                const mult = v?.priceMultiplier ?? 1;
                const basePrice =
                  p && (p.sellingPrice !== null && p.sellingPrice !== undefined)
                    ? p.sellingPrice
                    : p?.pricePerLitre ?? 0;
                const price = p ? (v?.price ?? basePrice * mult) : 0;
                const itemTotal = price * it.quantity;
                return (
                  <div key={getItemKey(it.productId, it.variationId)} className={styles.priceRow}>
                    <span>{it.quantity} x {p?.name || 'Product'}</span>
                    <span>₹{itemTotal.toFixed(2)}</span>
                  </div>
                );
              })}
              {subscriptionCartItem && (
                <div className={styles.priceRow}>
                  <span>1 X subscription for {subscriptionCartItem.productName}</span>
                  <span>₹{subscriptionCartItem.totalAmount.toFixed(2)}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className={styles.priceRow}>
                  <span>Coupon discount</span>
                  <span className={styles.discount}>-₹{couponDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className={styles.priceRow}>
                <span>Delivery Charges</span>
                <span className={styles.freeDelivery}>Free Delivery</span>
              </div>
              <div className={`${styles.priceRow} ${styles.priceRowTotal}`}>
                <span>Total Amount</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
            <div className={styles.totalSavingsBox}>
              <span className={styles.totalSavingsLabel}>Your total savings</span>
              <span className={styles.savings}>₹{savings.toFixed(2)}</span>
            </div>
            <div className={styles.paymentMethods}>
              <div className={styles.paymentMethodItem}>
                <span className={styles.paymentMethodLabel}>COD</span>
                <span className={styles.paymentMethodAvailable}>Available</span>
              </div>
              <div className={styles.paymentMethodItem}>
                <span className={styles.paymentMethodLabel}>Online Payment</span>
                <span className={styles.paymentMethodAvailable}>Available</span>
              </div>
            </div>
          </div>

          {/* Place Order Button */}
          <div className={styles.placeOrderContainer}>
            <div className={styles.totalAmountMobile}>
              <span className={styles.totalAmountLabel}>Total Amount</span>
              <span className={styles.totalAmountValue}>₹{total.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className={styles.placeOrderButton}
              disabled={items.length === 0}
            >
              Checkout
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          isOpen={isProductModalOpen}
          onClose={() => {
            setIsProductModalOpen(false);
            setSelectedProduct(null);
          }}
        />
      )}
    </div>
  );
}
