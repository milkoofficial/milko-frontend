'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import styles from './checkout.module.css';

type CheckoutStep = 'login' | 'address' | 'review';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { user, isAuthenticated, login, loading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('address');
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [stepInitialized, setStepInitialized] = useState(false);
  const manualStepChange = useRef(false);

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Address form state
  const [addressForm, setAddressForm] = useState({
    name: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    phone: '',
  });
  const [addressError, setAddressError] = useState('');

  // Load products
  useEffect(() => {
    const loadProducts = async () => {
      // Wait a bit to ensure cart context has loaded from localStorage
      // Cart context loads items in useEffect, so we need to wait for it
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Double-check items after waiting
      if (items.length === 0) {
        // Only redirect if we're sure there are no items
        // This prevents redirect loop if items are still loading
        router.push('/cart');
        return;
      }

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
      setLoading(false);
    };

    // Only run if we have items or if loading is still true
    if (items.length > 0 || loading) {
      loadProducts();
    }
  }, [items, router, loading]);

  // Initialize step - always start at address step (which will show login if needed)
  useEffect(() => {
    if (stepInitialized) return; // Only run once
    
    // Always start at address step (step 2)
    // The address step will show login form if user is not authenticated
    setCurrentStep('address');
    setStepInitialized(true);
  }, [stepInitialized]);

  // Helper function to set step with manual flag
  const setStep = (step: CheckoutStep) => {
    manualStepChange.current = true;
    setCurrentStep(step);
  };

  // Handle login (stays on address step, just hides login form)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (!email || !password) {
      setLoginError('Please fill in all required fields');
      return;
    }

    setLoginLoading(true);
    try {
      await login(email, password);
      // Stay on address step, login form will hide automatically
      // Clear login form
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle address form submission
  const handleAddressSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setAddressError('');

    // Validate required fields
    if (!addressForm.name || !addressForm.street || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      setAddressError('Please fill in all required fields');
      return;
    }

    // Check if user is logged in before proceeding to review
    if (!isAuthenticated || !user) {
      setAddressError('Please login to proceed with your order');
      return;
    }

    // Move to review step
    setStep('review');
  };

  // Calculate totals
  const subtotal = items.reduce((sum, it) => {
    const p = products[it.productId];
    if (!p) return sum;
    const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
    const mult = v?.priceMultiplier ?? 1;
    return sum + p.pricePerLitre * mult * it.quantity;
  }, 0);

  const deliveryCharges = 0; // Free delivery
  const total = subtotal + deliveryCharges;

  // Handle place order
  const handlePlaceOrder = async () => {
    if (!addressForm.name || !addressForm.street || !addressForm.city || !addressForm.state || !addressForm.postalCode) {
      alert('Please fill in all address fields');
      return;
    }

    setPlacingOrder(true);
    try {
      // Save delivery address and order items to localStorage for order success page
      localStorage.setItem('milko_delivery_address', JSON.stringify(addressForm));
      localStorage.setItem('milko_order_items', JSON.stringify(items));
      
      // TODO: Integrate with order API when available
      // For now, redirect to success page
      // After payment integration, redirect here after successful payment
      clearCart();
      router.push('/order-success');
    } catch (error) {
      console.error('Failed to place order:', error);
      alert('Failed to place order. Please try again.');
    } finally {
      setPlacingOrder(false);
    }
  };

  if (loading || authLoading || items.length === 0) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Progress Bar */}
      <div className={styles.progressBar}>
        <div className={`${styles.progressStep} ${styles.progressStepCompleted}`}>
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Cart</span>
        </div>
        <div className={`${styles.progressStep} ${currentStep === 'address' ? styles.progressStepActive : currentStep === 'review' ? styles.progressStepCompleted : ''}`}>
          <span className={styles.stepNumber}>2</span>
          <span className={styles.stepLabel}>Address</span>
        </div>
        <div className={`${styles.progressStep} ${currentStep === 'review' ? styles.progressStepActive : ''}`}>
          <span className={styles.stepNumber}>3</span>
          <span className={styles.stepLabel}>Place Order</span>
        </div>
      </div>

      <div className={styles.checkoutContent}>
        {/* Left Column - Steps */}
        <div className={styles.stepsColumn}>
          {/* Step 2: Address (with optional Login if not authenticated) */}
          {currentStep === 'address' && (
            <div className={styles.stepCard}>
              {/* Show Login Form if user is not authenticated */}
              {!isAuthenticated || !user ? (
                <div className={styles.loginSection}>
                  <h2 className={styles.stepTitle}>Login to Continue</h2>
                  <p className={styles.stepDescription}>Please login to proceed with your order</p>
                  
                  <form onSubmit={handleLogin} className={styles.loginForm}>
                    {loginError && (
                      <div className={styles.errorMessage}>{loginError}</div>
                    )}
                    
                    <FloatingLabelInput
                      type="email"
                      label="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    
                    <div className={styles.passwordInputWrapper}>
                      <FloatingLabelInput
                        type={showPassword ? 'text' : 'password'}
                        label="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>

                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={loginLoading}
                    >
                      {loginLoading ? 'Logging in...' : 'Login'}
                    </button>
                  </form>

                  <div className={styles.authLinks}>
                    <p>Don't have an account? <a href="/auth/signup">Sign up</a></p>
                  </div>

                  <div className={styles.divider}>
                    <span>OR</span>
                  </div>
                </div>
              ) : null}

              {/* Address Form - Always visible */}
              <div className={styles.addressSection}>
                <h2 className={styles.stepTitle}>Delivery Address</h2>
                <p className={styles.stepDescription}>Please provide your delivery address</p>
                
                <form onSubmit={handleAddressSubmit} className={styles.addressForm} noValidate>
                {addressError && (
                  <div className={styles.errorMessage}>{addressError}</div>
                )}

                <FloatingLabelInput
                  type="text"
                  label="Full Name"
                  value={addressForm.name}
                  onChange={(e) => setAddressForm({ ...addressForm, name: e.target.value })}
                  required
                />

                <FloatingLabelInput
                  type="tel"
                  label="Phone Number"
                  value={addressForm.phone}
                  onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                />

                <FloatingLabelInput
                  type="text"
                  label="Street Address"
                  value={addressForm.street}
                  onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                  required
                />

                <div className={styles.addressRow}>
                  <FloatingLabelInput
                    type="text"
                    label="City"
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    required
                  />
                  <FloatingLabelInput
                    type="text"
                    label="State"
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    required
                  />
                </div>

                <div className={styles.addressRow}>
                  <FloatingLabelInput
                    type="text"
                    label="Postal Code"
                    value={addressForm.postalCode}
                    onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                    required
                  />
                  <FloatingLabelInput
                    type="text"
                    label="Country"
                    value={addressForm.country}
                    onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className={styles.primaryButton}
                >
                  Continue to Review
                </button>
              </form>
              </div>
            </div>
          )}

          {/* Step 3: Review & Place Order */}
          {currentStep === 'review' && (
            <div className={styles.stepCard}>
              <h2 className={styles.stepTitle}>Review Your Order</h2>
              <p className={styles.stepDescription}>Please review your order details before placing</p>
              
              {/* Order Items */}
              <div className={styles.orderItems}>
                <h3 className={styles.sectionTitle}>Order Items</h3>
                {items.map((it) => {
                  const p = products[it.productId];
                  const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
                  const mult = v?.priceMultiplier ?? 1;
                  const price = p ? p.pricePerLitre * mult : 0;
                  const itemTotal = price * it.quantity;

                  return (
                    <div key={`${it.productId}:${it.variationId || ''}`} className={styles.orderItem}>
                      <div className={styles.orderItemInfo}>
                        <span className={styles.orderItemName}>{p?.name || 'Product'}</span>
                        {v && <span className={styles.orderItemVariation}>{v.size}</span>}
                        <span className={styles.orderItemQuantity}>Qty: {it.quantity}</span>
                      </div>
                      <span className={styles.orderItemPrice}>₹{itemTotal.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Delivery Address */}
              <div className={styles.deliveryAddress}>
                <h3 className={styles.sectionTitle}>Delivery Address</h3>
                <div className={styles.addressDisplay}>
                  <p><strong>{addressForm.name}</strong></p>
                  <p>{addressForm.street}</p>
                  <p>{addressForm.city}, {addressForm.state} {addressForm.postalCode}</p>
                  <p>{addressForm.country}</p>
                  {addressForm.phone && <p>Phone: {addressForm.phone}</p>}
                </div>
                <button
                  type="button"
                  className={styles.editButton}
                  onClick={() => setStep('address')}
                >
                  Edit Address
                </button>
              </div>

              {/* Place Order Button */}
              <button
                onClick={handlePlaceOrder}
                className={styles.placeOrderButton}
                disabled={placingOrder}
              >
                {placingOrder ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Order Summary */}
        <div className={styles.summaryColumn}>
          <div className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>Order Summary</h3>
            
            <div className={styles.summaryRow}>
              <span>Subtotal</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>
            
            <div className={styles.summaryRow}>
              <span>Delivery Charges</span>
              <span className={styles.freeDelivery}>Free</span>
            </div>
            
            <div className={`${styles.summaryRow} ${styles.summaryRowTotal}`}>
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
