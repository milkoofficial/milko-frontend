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
  const [savingAddressForCheckout, setSavingAddressForCheckout] = useState(false);

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

  // Save new address to account when "Save this address" is checked (used by form submit and summary Checkout button)
  const saveNewAddressIfRequested = async (): Promise<{ ok: boolean }> => {
    if (!saveAddress || selectedAddressId) return { ok: true };
    if (!addressForm.name?.trim() || !addressForm.street?.trim() || !addressForm.city?.trim() || !addressForm.state?.trim() || !addressForm.postalCode?.trim() || !addressForm.country?.trim() || !addressForm.phone?.trim()) {
      setAddressError('Please fill in all required fields');
      return { ok: false };
    }
    try {
      await addressesApi.create({
        name: addressForm.name.trim(),
        street: addressForm.street.trim(),
        city: addressForm.city.trim(),
        state: addressForm.state.trim(),
        postalCode: addressForm.postalCode.trim(),
        country: addressForm.country.trim(),
        phone: addressForm.phone.trim(),
        isDefault: savedAddresses.length === 0,
      });
      const addresses = await addressesApi.getAll();
      setSavedAddresses(addresses);
      return { ok: true };
    } catch (error: any) {
      setAddressError(error.message || 'Failed to save address');
      return { ok: false };
    }
  };

  // Handle address form submission
  const handleAddressSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setAddressError('');

    if (!addressForm.name?.trim() || !addressForm.street?.trim() || !addressForm.city?.trim() || !addressForm.state?.trim() || !addressForm.postalCode?.trim() || !addressForm.country?.trim() || !addressForm.phone?.trim()) {
      setAddressError('Please fill in all required fields');
      return;
    }

    if (!isAuthenticated || !user) {
      setAddressError('Please login to proceed with your order');
      return;
    }

    const { ok } = await saveNewAddressIfRequested();
    if (!ok) return;

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

  // Your total savings = sum of (compareAtPrice - sellingPrice) * mult * qty per item
  const savings = items.reduce((sum, it) => {
    const p = products[it.productId];
    if (!p) return sum;
    const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
    const mult = v?.priceMultiplier ?? 1;
    const compare = (p.compareAtPrice != null && p.compareAtPrice !== undefined) ? p.compareAtPrice : p.pricePerLitre;
    const selling = (p.sellingPrice != null && p.sellingPrice !== undefined) ? p.sellingPrice : p.pricePerLitre;
    const perUnit = Math.max(0, compare - selling);
    return sum + perUnit * mult * it.quantity;
  }, 0);

  const isAddressFulfilled = !!(isAuthenticated && user) && (
    (savedAddresses.length > 0 && selectedAddressId && !showCreateNewAddress) ||
    !!(addressForm.name?.trim() && addressForm.street?.trim() && addressForm.city?.trim() && addressForm.state?.trim() && addressForm.postalCode?.trim() && addressForm.country?.trim() && addressForm.phone?.trim())
  );

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
    if (!addressForm.name?.trim() || !addressForm.street?.trim() || !addressForm.city?.trim() || !addressForm.state?.trim() || !addressForm.postalCode?.trim() || !addressForm.country?.trim() || !addressForm.phone?.trim()) {
      alert('Please fill in all required address fields');
      return;
    }

    setPlacingOrder(true);
    try {
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
      {/* Progress Bar - clickable: 1→cart, 2 from review, 3 when address fulfilled */}
      <div className={styles.progressBar}>
        <div
          className={`${styles.progressStep} ${styles.progressStepCompleted} ${styles.progressStepClickable}`}
          onClick={() => router.push('/cart')}
        >
          <span className={styles.stepNumber}>1</span>
          <span className={styles.stepLabel}>Cart</span>
        </div>
        <div
          className={`${styles.progressStep} ${currentStep === 'address' ? styles.progressStepActive : currentStep === 'review' ? styles.progressStepCompleted : ''} ${currentStep === 'review' ? styles.progressStepClickable : styles.progressStepDisabled}`}
          onClick={() => { if (currentStep === 'review') setStep('address'); }}
        >
          <span className={styles.stepNumber}>2</span>
          <span className={styles.stepLabel}>Address</span>
        </div>
        <div
          className={`${styles.progressStep} ${currentStep === 'review' ? styles.progressStepActive : ''} ${isAddressFulfilled ? styles.progressStepClickable : styles.progressStepDisabled}`}
          onClick={() => { if (isAddressFulfilled && currentStep === 'address') setStep('review'); }}
        >
          <span className={styles.stepNumber}>3</span>
          <span className={styles.stepLabel}>Place Order</span>
        </div>
      </div>

      <div className={styles.checkoutContent}>
        {/* Step content first; price summary at the bottom */}
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
                  required
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
                  <div
                    className={styles.saveAddressCheckbox}
                    role="checkbox"
                    aria-checked={saveAddress}
                    tabIndex={0}
                    onPointerDown={(e) => {
                      // Prevent focus-on-click (can trigger scroll-into-view jumps on some browsers)
                      e.preventDefault();
                    }}
                    onClick={() => setSaveAddress((prev) => !prev)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        setSaveAddress((prev) => !prev);
                      }
                    }}
                  >
                    <span className={`${styles.checkboxIcon} ${saveAddress ? styles.checkboxIconChecked : ''}`}>
                      {saveAddress && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" fill="currentColor" />
                        </svg>
                      )}
                    </span>
                    <span className={styles.checkboxLabel}>Save this address for future orders</span>
                  </div>
                )}

                {/* Submit in step card: only when no saved addresses. When creating new (with saved), use summary's Continue. */}
                {savedAddresses.length === 0 && (
                  <button
                    type="submit"
                    className={styles.primaryButton}
                  >
                    {saveAddress ? 'Save Address & Continue' : 'Continue to Checkout'}
                  </button>
                )}
              </form>
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Price summary at bottom: after address section (step 2) or below step card (step 3) */}
        <div className={styles.summaryColumn}>
          <div className={styles.summarySticky}>
          <div className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>Price Details</h3>
            <div className={styles.priceDetailsBox}>
              <div className={styles.priceRow}>
                <span>{items.length} item{items.length !== 1 ? 's' : ''}</span>
              </div>
              {items.map((it) => {
                const p = products[it.productId];
                const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
                const basePrice = p && (p.sellingPrice != null && p.sellingPrice !== undefined) ? p.sellingPrice : (p ? p.pricePerLitre : 0);
                const mult = v?.priceMultiplier ?? 1;
                const unitPrice = p ? (v?.price ?? basePrice * mult) : 0;
                const itemTotal = unitPrice * it.quantity;
                return (
                  <div key={`${it.productId}:${it.variationId || ''}`} className={styles.priceRow}>
                    <span>{it.quantity} × {p?.name || 'Product'}{v ? ` (${v.size})` : ''}</span>
                    <span>₹{itemTotal.toFixed(2)}</span>
                  </div>
                );
              })}
              {discount > 0 && (
                <div className={styles.priceRow}>
                  <span>Coupon ({couponValidation.coupon?.code})</span>
                  <span className={styles.discountAmount}>-₹{discount.toFixed(2)}</span>
                </div>
              )}
              <div className={styles.priceRow}>
                <span>Delivery</span>
                <span className={styles.freeDelivery}>Free</span>
              </div>
              <div className={`${styles.priceRow} ${styles.priceRowTotal}`}>
                <span>Total</span>
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

          {/* Continue to Checkout: when saved-address selected or creating new and form filled. Hidden when no saved addresses (use form submit). */}
          {currentStep === 'address' && isAddressFulfilled && ((savedAddresses.length > 0 && selectedAddressId && !showCreateNewAddress) || showCreateNewAddress) && (
            <div className={styles.summaryButtonWrapper}>
              <div className={styles.totalAmountSection}>
                <div className={styles.totalAmountLabel}>Total amount</div>
                <div className={styles.totalAmountValue}>₹{total.toFixed(2)}</div>
              </div>
              <button
                type="button"
                className={styles.summaryButtonBelow}
                disabled={savingAddressForCheckout}
                onClick={async () => {
                  setSavingAddressForCheckout(true);
                  const { ok } = await saveNewAddressIfRequested();
                  setSavingAddressForCheckout(false);
                  if (!ok) return;
                  setStep('review');
                }}
              >
                {savingAddressForCheckout ? 'Saving...' : 'Checkout'}
              </button>
            </div>
          )}

          {/* Place Order - below summary, only on review step */}
          {currentStep === 'review' && (
            <div className={styles.summaryButtonWrapper}>
              <div className={styles.totalAmountSection}>
                <div className={styles.totalAmountLabel}>Total amount</div>
                <div className={styles.totalAmountValue}>₹{total.toFixed(2)}</div>
              </div>
              <button type="button" onClick={handlePlaceOrder} className={styles.summaryButtonBelow} disabled={placingOrder}>
                {placingOrder ? 'Placing Order...' : 'Place Order'}
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
