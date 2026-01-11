'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import styles from './cart.module.css';

export default function CartPage() {
  const { items, setItemQuantity, removeItem } = useCart();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [isGiftWrap, setIsGiftWrap] = useState(false);

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
      
      // Items are not selected by default (selection is for deletion)
      setSelectedItems(new Set());
    };
    if (items.length) load();
  }, [items]);

  const getItemKey = (productId: string, variationId?: string) => {
    return `${productId}:${variationId || ''}`;
  };

  const toggleItemSelection = (productId: string, variationId?: string) => {
    const key = getItemKey(productId, variationId);
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      const allKeys = items.map(it => getItemKey(it.productId, it.variationId));
      setSelectedItems(new Set(allKeys));
    }
  };

  const handleQuantityChange = (productId: string, variationId: string | undefined, delta: number) => {
    const item = items.find(it => it.productId === productId && it.variationId === variationId);
    if (item) {
      const newQuantity = Math.max(1, item.quantity + delta);
      setItemQuantity(productId, newQuantity, variationId);
    }
  };

  // Items to keep (not selected = not marked for deletion)
  const itemsToKeep = useMemo(() => {
    return items.filter(it => !selectedItems.has(getItemKey(it.productId, it.variationId)));
  }, [items, selectedItems]);

  const subtotal = useMemo(() => {
    return itemsToKeep.reduce((sum, it) => {
      const p = products[it.productId];
      if (!p) return sum;
      const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
      const mult = v?.priceMultiplier ?? 1;
      return sum + p.pricePerLitre * mult * it.quantity;
    }, 0);
  }, [itemsToKeep, products]);

  const deliveryCharges = itemsToKeep.length > 0 ? 0 : 0; // Free delivery
  const giftWrapCharge = isGiftWrap ? 20 : 0;
  const total = subtotal - couponDiscount + deliveryCharges + giftWrapCharge;

  const handleApplyCoupon = () => {
    if (couponCode.trim()) {
      // TODO: Implement coupon validation with API
      setAppliedCoupon(couponCode.trim().toUpperCase());
      setCouponDiscount(2.50); // Placeholder discount
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponDiscount(0);
  };

  const handlePlaceOrder = () => {
    if (itemsToKeep.length === 0) {
      alert('Please add at least one item to place an order');
      return;
    }
    // TODO: Navigate to checkout/address page
    console.log('Place order with items:', itemsToKeep);
  };

  if (items.length === 0) {
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
          {/* Selection Summary */}
          <div className={styles.selectionSummary}>
            {selectedItems.size > 0 && (
              <div className={styles.actionLinks}>
                <button 
                  className={styles.actionLink}
                  onClick={() => {
                    items.filter(it => selectedItems.has(getItemKey(it.productId, it.variationId))).forEach(it => {
                      removeItem(it.productId, it.variationId);
                    });
                    setSelectedItems(new Set());
                  }}
                >
                  Remove {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''}
                </button>
              </div>
            )}
            {selectedItems.size === 0 && items.length > 0 && (
              <span className={styles.itemCount}>{items.length} item{items.length !== 1 ? 's' : ''} in cart</span>
            )}
          </div>

          {/* Items List */}
          <div className={styles.itemsList}>
            {items.map((it) => {
              const p = products[it.productId];
              const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
              const itemKey = getItemKey(it.productId, it.variationId);
              const isSelected = selectedItems.has(itemKey);
              const mult = v?.priceMultiplier ?? 1;
              const price = p ? p.pricePerLitre * mult : 0;
              const itemTotal = price * it.quantity;
              const productImage = p?.images?.[0]?.imageUrl || p?.imageUrl || '/placeholder-product.png';

              return (
                <div key={itemKey} className={`${styles.cartItem} ${isSelected ? styles.cartItemSelected : ''}`}>
                  <label className={styles.itemCheckbox}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleItemSelection(it.productId, it.variationId)}
                    />
                  </label>
                  
                  <div className={styles.itemImage}>
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

                  <div className={styles.itemDetails}>
                    <h3 className={styles.itemTitle}>{p ? p.name : 'Loading...'}</h3>
                    <div className={styles.itemInfo}>
                      {v && <span>{v.size}</span>}
                      <span>Fresh milk</span>
                      <span>Express delivery in 3 days</span>
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
                      ×
                    </button>
                  </div>
                </div>
              );
            })}
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
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="Enter coupon code"
                className={styles.couponInput}
                onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
              />
            )}
          </div>

          {/* Gifting */}
          <div className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>Gifting</h3>
            <div className={styles.giftingBox}>
              <div className={styles.giftingContent}>
                <p className={styles.giftingQuestion}>Buying for a loved one?</p>
                <p className={styles.giftingText}>
                  Send personalized message at ₹{giftWrapCharge}
                </p>
                <button
                  onClick={() => setIsGiftWrap(!isGiftWrap)}
                  className={styles.addGiftWrapLink}
                >
                  {isGiftWrap ? 'Remove gift wrap' : 'Add gift wrap'}
                </button>
              </div>
              <div className={styles.giftIcon}>🎁</div>
            </div>
          </div>

          {/* Price Details */}
          <div className={styles.summarySection}>
            <h3 className={styles.sectionTitle}>Price Details</h3>
              <div className={styles.priceDetailsBox}>
              <div className={styles.priceRow}>
                <span>{itemsToKeep.length} item{itemsToKeep.length !== 1 ? 's' : ''}</span>
              </div>
              {itemsToKeep.map((it) => {
                const p = products[it.productId];
                const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
                const mult = v?.priceMultiplier ?? 1;
                const price = p ? p.pricePerLitre * mult : 0;
                const itemTotal = price * it.quantity;
                return (
                  <div key={getItemKey(it.productId, it.variationId)} className={styles.priceRow}>
                    <span>{it.quantity} x {p?.name || 'Product'}</span>
                    <span>₹{itemTotal.toFixed(2)}</span>
                  </div>
                );
              })}
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
              {isGiftWrap && (
                <div className={styles.priceRow}>
                  <span>Gift wrap</span>
                  <span>₹{giftWrapCharge.toFixed(2)}</span>
                </div>
              )}
              <div className={`${styles.priceRow} ${styles.priceRowTotal}`}>
                <span>Total Amount</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Place Order Button */}
          <button
            onClick={handlePlaceOrder}
            className={styles.placeOrderButton}
            disabled={itemsToKeep.length === 0}
          >
            Place order
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
