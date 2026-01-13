'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/contexts/CartContext';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Select from '@/components/ui/Select';
import styles from './cart.module.css';

export default function CartPage() {
  const { items, setItemQuantity, removeItem } = useCart();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [selectedSubscription, setSelectedSubscription] = useState<{ name: string; price: number } | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionProducts, setSubscriptionProducts] = useState<Product[]>([]);
  const [subscriptionSelectedProduct, setSubscriptionSelectedProduct] = useState<string>('');
  const [subscriptionLitersPerDay, setSubscriptionLitersPerDay] = useState<string>('1');
  const [subscriptionDurationDays, setSubscriptionDurationDays] = useState<string>('30');
  
  // Subscription price is 0 as it's included in the subscription service itself

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

  // Fetch products for subscription form
  useEffect(() => {
    const fetchSubscriptionProducts = async () => {
      try {
        const data = await productsApi.getAll();
        if (data && data.length > 0) {
          setSubscriptionProducts(data);
          setSubscriptionSelectedProduct(data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch products for subscription:', error);
      }
    };
    fetchSubscriptionProducts();
  }, []);

  // Calculate subscription total amount
  const subscriptionSelectedProductData = subscriptionProducts.find(p => p.id === subscriptionSelectedProduct);
  const subscriptionTotalAmount = subscriptionSelectedProductData
    ? parseFloat(subscriptionLitersPerDay) * parseFloat(subscriptionDurationDays) * subscriptionSelectedProductData.pricePerLitre
    : 0;

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  };

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

  // Items to keep (not selected = not marked for deletion) - only used for remove functionality
  const itemsToKeep = useMemo(() => {
    return items.filter(it => !selectedItems.has(getItemKey(it.productId, it.variationId)));
  }, [items, selectedItems]);

  // Calculate subtotal based on ALL items in cart (not filtered by selection)
  const subtotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const p = products[it.productId];
      if (!p) return sum;
      const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
      const mult = v?.priceMultiplier ?? 1;
      return sum + p.pricePerLitre * mult * it.quantity;
    }, 0);
  }, [items, products]);

  const deliveryCharges = items.length > 0 ? 0 : 0; // Free delivery
  const subscriptionCharge = selectedSubscription ? selectedSubscription.price : 0;
  const total = subtotal - couponDiscount + deliveryCharges + subscriptionCharge;

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
    if (items.length === 0) {
      alert('Please add at least one item to place an order');
      return;
    }
    // TODO: Navigate to checkout/address page
    console.log('Place order with items:', items);
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
                  <div 
                    className={`${styles.itemCheckbox} ${isSelected ? styles.itemCheckboxChecked : ''}`}
                    onClick={() => toggleItemSelection(it.productId, it.variationId)}
                  >
                    {isSelected && (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  
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
              <div className={styles.couponInputContainer}>
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Enter coupon code"
                  className={styles.couponInput}
                  onKeyPress={(e) => e.key === 'Enter' && handleApplyCoupon()}
                />
                <button
                  onClick={handleApplyCoupon}
                  className={styles.applyCouponButton}
                  disabled={!couponCode.trim()}
                >
                  Apply
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
                  {selectedSubscription 
                    ? `${selectedSubscription.name} - ₹${selectedSubscription.price}/month`
                    : 'Choose a membership plan to save more'
                  }
                </p>
                <button
                  onClick={() => setShowSubscriptionModal(true)}
                  className={styles.addSubscriptionLink}
                >
                  {selectedSubscription ? 'Change subscription' : 'Select membership'}
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
                <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>
              {items.map((it) => {
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
              {selectedSubscription && (
                <div className={styles.priceRow}>
                  <span>Subscription ({selectedSubscription.name})</span>
                  <span className={styles.freeDelivery}>Free</span>
                </div>
              )}
              <div className={`${styles.priceRow} ${styles.priceRowTotal}`}>
                <span>Total Amount</span>
                <span>₹{total.toFixed(2)}</span>
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
              onClick={handlePlaceOrder}
              className={styles.placeOrderButton}
              disabled={items.length === 0}
            >
              Place order
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Membership Modal */}
      {showSubscriptionModal && (
        <div className={styles.modalOverlay} onClick={() => setShowSubscriptionModal(false)}>
          <div className={styles.subscriptionModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Become a Subscriber</h2>
              <button 
                className={styles.modalCloseButton}
                onClick={() => setShowSubscriptionModal(false)}
              >
                ×
              </button>
            </div>
            <div className={styles.subscriptionModalContent}>
              {/* Left Column - Benefits */}
              <div className={styles.subscriptionBenefitsColumn}>
                <h3 className={styles.subscriptionBenefitsTitle}>Why Choose Our Subscription?</h3>
                <ul className={styles.subscriptionBenefitsList}>
                  <li className={styles.subscriptionBenefitItem}>
                    <span className={styles.subscriptionBenefitIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className={styles.subscriptionBenefitText}>Fresh, home-handled milk delivered daily.</span>
                  </li>
                  <li className={styles.subscriptionBenefitItem}>
                    <span className={styles.subscriptionBenefitIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className={styles.subscriptionBenefitText}>Zero adulteration — no water, chemicals, or preservatives.</span>
                  </li>
                  <li className={styles.subscriptionBenefitItem}>
                    <span className={styles.subscriptionBenefitIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className={styles.subscriptionBenefitText}>Daily quality checks before delivery.</span>
                  </li>
                  <li className={styles.subscriptionBenefitItem}>
                    <span className={styles.subscriptionBenefitIcon} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                    <span className={styles.subscriptionBenefitText}>Priority delivery and assured supply for members.</span>
                  </li>
                  <li className={styles.subscriptionBenefitItem}>
                    <span className={styles.subscriptionBenefitIcon}>💰</span>
                    <span className={styles.subscriptionBenefitText}>Adulteration proven? ₹5,100 paid to the customer.</span>
                  </li>
                </ul>
              </div>

              {/* Right Column - Membership Card Form */}
              <div className={styles.subscriptionMembershipCard}>
                <div className={styles.subscriptionFormFields}>
                  {/* Product Selection */}
                  <div className={styles.subscriptionFormField}>
                    <label className={styles.subscriptionLabel}>Select Product</label>
                    <Select
                      className={styles.subscriptionSelect}
                      value={subscriptionSelectedProduct}
                      onChange={setSubscriptionSelectedProduct}
                      options={subscriptionProducts.map((product) => ({
                        value: product.id,
                        label: `${product.name} - ₹${product.pricePerLitre}/litre`,
                      }))}
                    />
                  </div>

                  {/* Liters Per Day */}
                  <div className={styles.subscriptionFormField}>
                    <label className={styles.subscriptionLabel}>Liters Per Day</label>
                    <Select
                      className={styles.subscriptionSelect}
                      value={subscriptionLitersPerDay}
                      onChange={setSubscriptionLitersPerDay}
                      options={[
                        { value: '0.5', label: '0.5 Liters' },
                        { value: '1', label: '1 Liter' },
                        { value: '2', label: '2 Liters' },
                        { value: '3', label: '3 Liters' },
                        { value: '4', label: '4 Liters' },
                        { value: '5', label: '5 Liters' },
                      ]}
                    />
                  </div>

                  {/* Duration (Days) */}
                  <div className={styles.subscriptionFormField}>
                    <label className={styles.subscriptionLabel}>Duration</label>
                    <Select
                      className={styles.subscriptionSelect}
                      value={subscriptionDurationDays}
                      onChange={setSubscriptionDurationDays}
                      options={[
                        { value: '7', label: '7 Days (1 Week)' },
                        { value: '15', label: '15 Days' },
                        { value: '30', label: '30 Days (1 Month)' },
                        { value: '60', label: '60 Days (2 Months)' },
                        { value: '90', label: '90 Days (3 Months)' },
                        { value: '180', label: '180 Days (6 Months)' },
                        { value: '365', label: '365 Days (1 Year)' },
                      ]}
                    />
                  </div>
                </div>

                {/* Amount Display */}
                <div className={styles.subscriptionAmountSection}>
                  <div className={styles.subscriptionAmountLabel}>Total Amount</div>
                  <div className={styles.subscriptionAmountValue}>
                    ₹{formatINR(subscriptionTotalAmount)}
                  </div>
                  {subscriptionSelectedProductData && (
                    <div className={styles.subscriptionAmountBreakdown}>
                      {subscriptionLitersPerDay}L/day × {subscriptionDurationDays} days × ₹{formatINR(subscriptionSelectedProductData.pricePerLitre)}/L
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className={styles.subscriptionCardActions}>
                  <button
                    className={styles.selectMembershipButton}
                    onClick={() => {
                      setSelectedSubscription({ name: 'Milko Subscription', price: 0 });
                      setShowSubscriptionModal(false);
                    }}
                    disabled={!subscriptionSelectedProduct || subscriptionTotalAmount === 0}
                  >
                    {selectedSubscription ? 'Update Subscription' : 'Select Subscription'}
                  </button>
                  {selectedSubscription && (
                    <button
                      className={styles.removeSubscriptionButton}
                      onClick={() => {
                        setSelectedSubscription(null);
                        setShowSubscriptionModal(false);
                      }}
                    >
                      Remove Subscription
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
