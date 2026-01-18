'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckoutStep } from '@/contexts/CheckoutStepContext';
import { productsApi, couponsApi, Coupon, addressesApi } from '@/lib/api';
import { Product, Address } from '@/types';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import styles from './checkout.module.css';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

type CheckoutStep = 'login' | 'address' | 'review';

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();
  const { user, isAuthenticated, login, loginWithGoogle, loading: authLoading } = useAuth();
  const { setCheckoutStep } = useCheckoutStep();
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
  
  // Saved addresses state
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showCreateNewAddress, setShowCreateNewAddress] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [couponValidation, setCouponValidation] = useState<{
    status: 'idle' | 'valid' | 'invalid';
    message: string;
    coupon: Coupon | null;
  }>({ status: 'idle', message: '', coupon: null });
  const [validatingCoupon, setValidatingCoupon] = useState(false);

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

  // Sync step to CheckoutStepContext for ConditionalFooter (hide footer on address step, mobile only)
  useEffect(() => {
    const step = currentStep === 'login' ? 'address' : currentStep;
    setCheckoutStep(step);
    return () => setCheckoutStep(null);
  }, [currentStep, setCheckoutStep]);

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

  // Fetch saved addresses when user is authenticated
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!isAuthenticated || !user) {
        setSavedAddresses([]);
        return;
      }

      try {
        setLoadingAddresses(true);
        const addresses = await addressesApi.getAll();
        setSavedAddresses(addresses);
        
        // If user has addresses and no address is selected, select the default one
        if (addresses.length > 0 && !selectedAddressId) {
          const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];
          if (defaultAddress) {
            setSelectedAddressId(defaultAddress.id);
            fillAddressForm(defaultAddress);
          }
        }
      } catch (error) {
        console.error('Failed to fetch addresses:', error);
      } finally {
        setLoadingAddresses(false);
      }
    };

    fetchAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

  // Fill address form with selected address
  const fillAddressForm = (address: Address) => {
    setAddressForm({
      name: address.name,
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India',
      phone: address.phone || '',
    });
  };

  // Handle address selection
  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
    setShowCreateNewAddress(false);
    const address = savedAddresses.find(addr => addr.id === addressId);
    if (address) {
      fillAddressForm(address);
    }
  };

  // Handle create new address option
  const handleCreateNewAddress = () => {
    setShowCreateNewAddress(true);
    setSelectedAddressId(null);
    setAddressForm({
      name: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      phone: '',
    });
  };

  // Handle address form submission
  const handleAddressSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

    // Save address if checkbox is checked and it's a new address
    if (saveAddress && !selectedAddressId) {
      try {
        await addressesApi.create({
          name: addressForm.name,
          street: addressForm.street,
          city: addressForm.city,
          state: addressForm.state,
          postalCode: addressForm.postalCode,
          country: addressForm.country,
          phone: addressForm.phone,
          isDefault: savedAddresses.length === 0, // Set as default if it's the first address
        });
        // Refresh addresses list
        const addresses = await addressesApi.getAll();
        setSavedAddresses(addresses);
      } catch (error: any) {
        setAddressError(error.message || 'Failed to save address');
        return;
      }
    }

    // Move to review step
    setStep('review');
  };

  // Calculate totals
  const subtotal = items.reduce((sum, it) => {
    const p = products[it.productId];
    if (!p) return sum;
    const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
    const basePrice = (p.sellingPrice !== null && p.sellingPrice !== undefined) 
      ? p.sellingPrice 
      : p.pricePerLitre;
    const mult = v?.priceMultiplier ?? 1;
    const unitPrice = v?.price ?? (basePrice * mult);
    return sum + unitPrice * it.quantity;
  }, 0);

  // Calculate discount
  const calculateDiscount = (): number => {
    if (couponValidation.status !== 'valid' || !couponValidation.coupon) {
      return 0;
    }

    const coupon = couponValidation.coupon;
    let discount = 0;

    if (coupon.discountType === 'percentage') {
      discount = (subtotal * coupon.discountValue) / 100;
      // Apply max discount cap if set
      if (coupon.maxDiscountAmount && discount > coupon.maxDiscountAmount) {
        discount = coupon.maxDiscountAmount;
      }
    } else {
      // Fixed amount
      discount = coupon.discountValue;
    }

    // Ensure discount doesn't exceed subtotal
    return Math.min(discount, subtotal);
  };

  const discount = calculateDiscount();
  const deliveryCharges = 0; // Free delivery
  const total = subtotal - discount + deliveryCharges;

  // Validate coupon code
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponValidation({ status: 'idle', message: '', coupon: null });
      return;
    }

    setValidatingCoupon(true);
    setCouponValidation({ status: 'idle', message: '', coupon: null });

    try {
      const coupon = await couponsApi.validate(couponCode.trim().toUpperCase(), subtotal);
      setCouponValidation({
        status: 'valid',
        message: `${couponCode.trim().toUpperCase()} code is valid`,
        coupon,
      });
    } catch (error: any) {
      setCouponValidation({
        status: 'invalid',
        message: `${couponCode.trim().toUpperCase()} code is invalid`,
        coupon: null,
      });
    } finally {
      setValidatingCoupon(false);
    }
  };

  // Clear coupon when code changes
  useEffect(() => {
    if (!couponCode.trim()) {
      setCouponValidation({ status: 'idle', message: '', coupon: null });
    }
  }, [couponCode]);

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

                    <div className={styles.orDivider}>
                      <span>or</span>
                    </div>

                    <button
                      type="button"
                      className={styles.googleButton}
                      onClick={() => loginWithGoogle()}
                    >
                      <GoogleIcon />
                      Continue with Google
                    </button>
                  </form>

                  <div className={styles.authLinks}>
                    <p>Don&apos;t have an account? <a href="/auth/signup">Sign up</a></p>
                  </div>
                </div>
              ) : null}

              {/* Address Section - only when logged in */}
              {(isAuthenticated && user) && (
              <div className={styles.addressSection}>
                <h2 className={styles.stepTitle}>Delivery Address</h2>
                <p className={styles.stepDescription}>Please provide your delivery address</p>
                
                {/* Saved Addresses Selection (if user has saved addresses) */}
                {isAuthenticated && user && savedAddresses.length > 0 && !showCreateNewAddress && (
                  <div className={styles.savedAddressesSection}>
                    <h3 className={styles.savedAddressesTitle}>Select a saved address</h3>
                    <div className={styles.savedAddressesList}>
                      {savedAddresses.map((address) => (
                        <div
                          key={address.id}
                          className={`${styles.savedAddressCard} ${selectedAddressId === address.id ? styles.savedAddressCardSelected : ''}`}
                          onClick={() => handleAddressSelect(address.id)}
                        >
                          <input
                            type="radio"
                            name="selectedAddress"
                            checked={selectedAddressId === address.id}
                            onChange={() => handleAddressSelect(address.id)}
                            className={styles.addressRadio}
                          />
                          <div className={styles.savedAddressContent}>
                            <div className={styles.savedAddressHeader}>
                              <span className={styles.savedAddressName}>{address.name}</span>
                              {address.isDefault && (
                                <span className={styles.defaultBadge}>Default</span>
                              )}
                            </div>
                            <div className={styles.savedAddressDetails}>
                              <p>{address.street}</p>
                              <p>{address.city}, {address.state} {address.postalCode}</p>
                              <p>{address.country}</p>
                              {address.phone && <p>Phone: {address.phone}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      className={styles.createNewAddressButton}
                      onClick={handleCreateNewAddress}
                    >
                      Create a new address
                    </button>
                  </div>
                )}

                {/* Address Form - Show when creating new address or no saved addresses */}
                {(showCreateNewAddress || savedAddresses.length === 0) && (
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

                {/* Save Address Checkbox - Only show for new addresses when user is authenticated */}
                {isAuthenticated && user && (showCreateNewAddress || savedAddresses.length === 0) && (
                  <div className={styles.saveAddressCheckbox}>
                    <input
                      type="checkbox"
                      id="saveAddress"
                      checked={saveAddress}
                      onChange={(e) => {
                        const y = window.scrollY;
                        setSaveAddress(e.target.checked);
                        requestAnimationFrame(() => {
                          requestAnimationFrame(() => window.scrollTo(0, y));
                        });
                      }}
                      className={styles.checkbox}
                    />
                    <label htmlFor="saveAddress" className={styles.checkboxLabel}>
                      <span className={`${styles.checkboxIcon} ${saveAddress ? styles.checkboxIconChecked : ''}`}>
                        {saveAddress && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                          </svg>
                        )}
                      </span>
                      Save this address for future orders
                    </label>
                  </div>
                )}

                {/* Submit Button - Only show when creating new address or no saved addresses */}
                {(showCreateNewAddress || savedAddresses.length === 0) && (
                  <button
                    type="submit"
                    className={styles.primaryButton}
                  >
                    {saveAddress ? 'Save Address & Continue' : 'Continue to Checkout'}
                  </button>
                )}
              </form>
              )}

              {/* Sticky Continue Button - Always visible on mobile, only when address is selected on desktop */}
              {isAuthenticated && user && savedAddresses.length > 0 && selectedAddressId && !showCreateNewAddress && (
                <div className={styles.stickyButtonContainer}>
                  <button
                    type="button"
                    onClick={() => setStep('review')}
                    className={styles.stickyContinueButton}
                  >
                    Continue to Checkout
                  </button>
                </div>
              )}
              </div>
              )}
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
                  const basePrice = p && (p.sellingPrice !== null && p.sellingPrice !== undefined)
                    ? p.sellingPrice
                    : (p ? p.pricePerLitre : 0);
                  const mult = v?.priceMultiplier ?? 1;
                  const price = p ? (v?.price ?? (basePrice * mult)) : 0;
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
            
            {discount > 0 && (
              <div className={`${styles.summaryRow} ${styles.summaryRowDiscount}`}>
                <span>Discount ({couponValidation.coupon?.code})</span>
                <span className={styles.discountAmount}>-₹{discount.toFixed(2)}</span>
              </div>
            )}
            
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
