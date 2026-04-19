'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { productsApi, subscriptionsApi, contentApi, walletApi, addressesApi } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  readScopedPincode,
  scopedPincodeKey,
  scopedPincodeStatusKey,
  writeSubscriptionCartJson,
} from '@/lib/utils/userScopedStorage';
import { Product, Address } from '@/types';
import styles from './SubscribePage.module.css';
import Link from 'next/link';

const AddressLocationPicker = dynamic(() => import('@/components/AddressLocationPicker'), { ssr: false });
const DEFAULT_DELIVERY_TIME_OPTIONS = [
  { label: '06:00 AM - 09:00 AM', value: '06:00' },
  { label: '05:00 PM - 08:00 PM', value: '17:00' },
];

/**
 * Subscribe Page
 * Allows customer to create a new subscription
 */
export default function SubscribePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();
  const pinUserId = user?.id ?? null;
  const productId = searchParams.get('productId');
  const isCartFlow = searchParams.get('from') === 'cart';
  const isRenewFlow = searchParams.get('renew') === '1';

  const [product, setProduct] = useState<Product | null>(null);
  const [resolvedProductId, setResolvedProductId] = useState(productId || '');
  const [cartFlowProducts, setCartFlowProducts] = useState<Product[]>([]);
  const [litresPerDay, setLitresPerDay] = useState(1);
  const [frequency, setFrequency] = useState<'daily'>('daily');
  const [durationDays, setDurationDays] = useState(30);
  const [deliveryTime, setDeliveryTime] = useState(DEFAULT_DELIVERY_TIME_OPTIONS[0].value);
  const [deliveryTimeOptions, setDeliveryTimeOptions] = useState<Array<{ label: string; value: string }>>(DEFAULT_DELIVERY_TIME_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'wallet'>('online');
  const [walletBalance, setWalletBalance] = useState(0);
  const [pincodeStatus, setPincodeStatus] = useState<'checking' | 'missing' | 'available' | 'unavailable'>('checking');
  const [savedPincode, setSavedPincode] = useState('');
  const [serviceablePincodes, setServiceablePincodes] = useState<Array<{ pincode: string; deliveryTime?: string }> | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [mapModalAddress, setMapModalAddress] = useState<Address | null>(null);
  const [mapModalDraft, setMapModalDraft] = useState<{
    name: string;
    phone: string;
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    latitude?: number;
    longitude?: number;
  } | null>(null);
  const [mapSaving, setMapSaving] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [creatingAddress, setCreatingAddress] = useState(false);
  const [newAddressForm, setNewAddressForm] = useState({
    name: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  const isDeliverable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (cleaned.length !== 6) return false;
    if (!serviceablePincodes || serviceablePincodes.length === 0) return true;
    return serviceablePincodes.some((e) => (typeof e === 'string' ? e : e.pincode) === cleaned);
  };

  useEffect(() => {
    // Get pre-filled values from URL params
    const litersParam = searchParams.get('liters');
    const daysParam = searchParams.get('days');
    const monthsParam = searchParams.get('months');
    const frequencyParam = searchParams.get('frequency');
    
    if (litersParam) {
      setLitresPerDay(parseFloat(litersParam));
    }
    if (monthsParam) {
      setDurationDays(parseInt(monthsParam, 10) * 30);
    } else if (daysParam) {
      setDurationDays(parseInt(daysParam, 10));
    }

    if (frequencyParam === 'daily') {
      setFrequency(frequencyParam);
    }

    const fetchProduct = async () => {
      try {
        if (isCartFlow) {
          const allProducts = await productsApi.getAll();
          const eligibleProducts = allProducts.filter((p) => p.isActive !== false && p.isMembershipEligible);
          setCartFlowProducts(eligibleProducts);
          if (eligibleProducts.length === 0) {
            router.push('/products');
            return;
          }

          const selectedFromQuery = productId
            ? eligibleProducts.find((p) => p.id === productId)
            : null;
          const picked = selectedFromQuery || eligibleProducts[0];
          setProduct(picked);
          setResolvedProductId(picked.id);
          return;
        }

        if (productId) {
          const data = await productsApi.getById(productId);
          setProduct(data);
          setResolvedProductId(productId);
          return;
        }
        router.push('/products');
      } catch (error) {
        console.error('Failed to fetch product:', error);
        router.push('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId, router, searchParams, isCartFlow]);

  useEffect(() => {
    if (!isCartFlow || !resolvedProductId) return;
    if (cartFlowProducts.length === 0) return;
    const selected = cartFlowProducts.find((p) => p.id === resolvedProductId);
    if (selected) {
      setProduct(selected);
    }
  }, [isCartFlow, resolvedProductId, cartFlowProducts]);

  useEffect(() => {
    const loadWallet = async () => {
      try {
        const w = await walletApi.getSummary();
        setWalletBalance(w.balance || 0);
      } catch {
        setWalletBalance(0);
      }
    };
    loadWallet();
  }, []);

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        setLoadingAddresses(true);
        const addresses = await addressesApi.getAll();
        setSavedAddresses(addresses);
        if (addresses.length > 0) {
          const defaultAddress = addresses.find((a) => a.isDefault && isDeliverable((a.postalCode || '').trim()) && typeof a.latitude === 'number' && typeof a.longitude === 'number')
            || addresses.find((a) => isDeliverable((a.postalCode || '').trim()) && typeof a.latitude === 'number' && typeof a.longitude === 'number')
            || addresses.find((a) => a.isDefault && isDeliverable((a.postalCode || '').trim()))
            || addresses.find((a) => isDeliverable((a.postalCode || '').trim()))
            || addresses[0];
          setSelectedAddressId(defaultAddress?.id || null);
        }
      } catch {
        setSavedAddresses([]);
        setSelectedAddressId(null);
      } finally {
        setLoadingAddresses(false);
      }
    };
    loadAddresses();
  }, []);

  useEffect(() => {
    const syncPincodeState = async () => {
      let list: Array<{ pincode: string; deliveryTime?: string }> | null = null;
      try {
        const cfg = await contentApi.getByType('pincodes');
        const meta = (cfg?.metadata || {}) as any;
        if (Array.isArray(meta.deliveryTimeSlots) && meta.deliveryTimeSlots.length > 0) {
          const parsedSlots = meta.deliveryTimeSlots
            .map((slot: any) => ({
              label: (slot?.label || '').toString().trim(),
              value: (slot?.value || '').toString().trim(),
            }))
            .filter((slot: { label: string; value: string }) => slot.label && slot.value);
          setDeliveryTimeOptions(parsedSlots.length > 0 ? parsedSlots : DEFAULT_DELIVERY_TIME_OPTIONS);
        } else {
          setDeliveryTimeOptions(DEFAULT_DELIVERY_TIME_OPTIONS);
        }
        let parsed: Array<{ pincode: string; deliveryTime?: string }> = [];
        if (Array.isArray(meta.serviceablePincodes)) {
          parsed = meta.serviceablePincodes
            .map((el: any) =>
              typeof el === 'string'
                ? { pincode: el.trim(), deliveryTime: '1h' }
                : { pincode: (el.pincode || el).toString().trim(), deliveryTime: (el.deliveryTime || '1h').toString().trim() || '1h' }
            )
            .filter((x: { pincode: string }) => x.pincode.length === 6);
        } else if (typeof meta.serviceablePincode === 'string' && meta.serviceablePincode.trim()) {
          parsed = [{ pincode: meta.serviceablePincode.trim(), deliveryTime: '1h' }];
        }
        list = parsed.length > 0 ? parsed : null;
        setServiceablePincodes(list);
      } catch {
        setServiceablePincodes(null);
        list = null;
      }

      const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId);
      const pin = (selectedAddress?.postalCode || readScopedPincode(pinUserId) || '').trim();
      setSavedPincode(pin);
      if (pin.length !== 6) {
        setPincodeStatus('missing');
        return;
      }
      if (!list || list.length === 0) {
        setPincodeStatus('available');
      } else {
        const ok = list.some((e) => e.pincode === pin.trim());
        setPincodeStatus(ok ? 'available' : 'unavailable');
      }
    };

    syncPincodeState();

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === scopedPincodeKey(pinUserId)
        || e.key === scopedPincodeStatusKey(pinUserId)
        || e.key === 'milko_delivery_pincode'
        || e.key === 'milko_delivery_status'
      ) {
        syncPincodeState();
      }
    };
    const onPincodeUpdated = () => syncPincodeState();

    window.addEventListener('storage', onStorage);
    window.addEventListener('milko:pincode-updated', onPincodeUpdated as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('milko:pincode-updated', onPincodeUpdated as EventListener);
    };
  }, [savedAddresses, selectedAddressId, pinUserId]);

  useEffect(() => {
    if (!deliveryTimeOptions.some((slot) => slot.value === deliveryTime)) {
      setDeliveryTime(deliveryTimeOptions[0]?.value || DEFAULT_DELIVERY_TIME_OPTIONS[0].value);
    }
  }, [deliveryTimeOptions, deliveryTime]);

  useEffect(() => {
    if (savedAddresses.length === 0) {
      setSelectedAddressId(null);
      return;
    }
    const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId);
    const selectedDeliverable = selectedAddress
      ? isDeliverable((selectedAddress.postalCode || '').trim())
      : false;
    if (selectedDeliverable) return;
    const firstDeliverable = savedAddresses.find((a) => isDeliverable((a.postalCode || '').trim()));
    setSelectedAddressId(firstDeliverable ? firstDeliverable.id : null);
  }, [savedAddresses, serviceablePincodes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedProductId) return;
    if (isCartFlow && !isRenewFlow) {
      if (!product) return;
      if (!isAuthenticated || !user?.id) {
        const returnPath = `/subscribe?${searchParams.toString()}`;
        localStorage.setItem('milko_return_after_auth', returnPath);
        router.replace(`/auth/login?redirect=${encodeURIComponent(returnPath)}`);
        return;
      }
      if (!selectedAddressId) {
        alert('Please select a delivery address to add this subscription to your cart.');
        return;
      }
      const addr = savedAddresses.find((a) => a.id === selectedAddressId);
      if (!addr || typeof addr.latitude !== 'number' || typeof addr.longitude !== 'number') {
        alert('Please set your exact location on the map for the selected address before continuing.');
        return;
      }
      if (pincodeStatus !== 'available') {
        alert('Delivery is not available for this address pincode. Please choose a serviceable address.');
        return;
      }
      const durationMonths = Math.max(1, Math.round(durationDays / 30));
      const subscriptionCartItem = {
        type: 'subscription',
        productId: resolvedProductId,
        productName: product.name,
        litresPerDay,
        durationDays,
        durationMonths,
        deliveryTime,
        paymentMethod,
        totalAmount: Number((product.pricePerLitre * litresPerDay * durationDays).toFixed(2)),
        updatedAt: new Date().toISOString(),
      };
      writeSubscriptionCartJson(user.id, JSON.stringify(subscriptionCartItem));
      router.push('/cart');
      return;
    }
    if (!isAuthenticated) {
      const returnPath = `/subscribe${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
      localStorage.setItem('milko_return_after_auth', returnPath);
      router.replace(`/auth/login?redirect=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (!selectedAddressId) {
      alert('Please select a delivery address to continue.');
      return;
    }
    const selectedAddress = savedAddresses.find((a) => a.id === selectedAddressId);
    if (!selectedAddress || typeof selectedAddress.latitude !== 'number' || typeof selectedAddress.longitude !== 'number') {
      alert('Please set exact live location for the selected address before proceeding.');
      return;
    }
    if (pincodeStatus === 'missing') {
      alert('Selected address pincode is missing or invalid.');
      return;
    }
    if (pincodeStatus !== 'available') {
      return;
    }

    setSubmitting(true);
    let openedRazorpay = false;
    try {
      const durationMonths = Math.max(1, Math.round(durationDays / 30));
      const result = await subscriptionsApi.create({
        productId: resolvedProductId,
        litresPerDay,
        frequency,
        durationDays,
        durationMonths,
        deliveryTime,
        paymentMethod,
        addressId: selectedAddressId,
      });

      if (!result.razorpayOrder) {
        if (result.subscription.status !== 'active') {
          alert('Subscription created, but payment is unavailable (Razorpay not configured). Please recharge your wallet or try later.');
        } else {
          setShowSuccessModal(true);
        }
        return;
      }

      const loadRazorpayScript = (): Promise<void> => {
        if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
          return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = 'https://checkout.razorpay.com/v1/checkout.js';
          s.async = true;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load Razorpay'));
          document.head.appendChild(s);
        });
      };

      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
      const rzp = new Razorpay({
        key: result.razorpayOrder.key,
        order_id: result.razorpayOrder.orderId,
        currency: result.razorpayOrder.currency || 'INR',
        name: 'Milko',
        description: 'Subscription payment',
        handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string }) {
          try {
            await subscriptionsApi.verifyPayment({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
            });
            setShowSuccessModal(true);
          } catch (err) {
            console.error(err);
            alert('Payment verification failed. Please contact support.');
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => setSubmitting(false),
        },
      });
      openedRazorpay = true;
      rzp.open();
    } catch (error) {
      console.error('Failed to create subscription:', error);
      alert((error as { message?: string })?.message || 'Failed to create subscription. Please try again.');
    } finally {
      if (!openedRazorpay) setSubmitting(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  if (!product) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Product not found</div>;
  }

  const subscriptionTotal = product.pricePerLitre * litresPerDay * durationDays;
  const walletUsedPreview = Math.max(0, Math.min(walletBalance, subscriptionTotal));
  const onlineDuePreview = Math.max(0, Math.round((subscriptionTotal - walletUsedPreview) * 100) / 100);
  const perLitreDiscount = Math.max(
    0,
    Number((product.compareAtPrice ?? product.sellingPrice ?? 0) - product.pricePerLitre) || 0,
  );
  const visibleAddresses = savedAddresses.filter((a) => isDeliverable((a.postalCode || '').trim()));
  const hiddenAddressCount = Math.max(0, savedAddresses.length - visibleAddresses.length);

  const openMapModal = (address: Address) => {
    setMapModalAddress(address);
    setMapModalDraft({
      name: address.name,
      phone: address.phone || '',
      street: address.street,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      country: address.country || 'India',
      latitude: address.latitude,
      longitude: address.longitude,
    });
  };

  const closeMapModal = () => {
    if (mapSaving) return;
    setMapModalAddress(null);
    setMapModalDraft(null);
  };

  const openAddLocationModal = () => {
    setNewAddressForm({
      name: '',
      phone: '',
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
      latitude: undefined,
      longitude: undefined,
    });
    setShowAddLocationModal(true);
  };

  const closeAddLocationModal = () => {
    if (creatingAddress) return;
    setShowAddLocationModal(false);
  };

  const createAddressFromModal = async () => {
    if (
      !newAddressForm.name.trim()
      || !newAddressForm.phone.trim()
      || !newAddressForm.street.trim()
      || !newAddressForm.city.trim()
      || !newAddressForm.state.trim()
      || !newAddressForm.postalCode.trim()
      || !newAddressForm.country.trim()
    ) {
      alert('Please fill all address fields.');
      return;
    }
    if (newAddressForm.latitude === undefined || newAddressForm.longitude === undefined) {
      alert('Please set exact location on map.');
      return;
    }
    if (!isDeliverable(newAddressForm.postalCode.trim())) {
      alert('This pincode is not deliverable.');
      return;
    }

    setCreatingAddress(true);
    try {
      const created = await addressesApi.create({
        name: newAddressForm.name.trim(),
        phone: newAddressForm.phone.trim(),
        street: newAddressForm.street.trim(),
        city: newAddressForm.city.trim(),
        state: newAddressForm.state.trim(),
        postalCode: newAddressForm.postalCode.trim(),
        country: 'India',
        latitude: newAddressForm.latitude,
        longitude: newAddressForm.longitude,
        isDefault: savedAddresses.length === 0,
      });
      const addresses = await addressesApi.getAll();
      setSavedAddresses(addresses);
      setSelectedAddressId(created.id);
      setShowAddLocationModal(false);
    } catch (e) {
      alert((e as { message?: string })?.message || 'Failed to add location');
    } finally {
      setCreatingAddress(false);
    }
  };

  const saveAddressFromMapModal = async () => {
    if (!mapModalAddress || !mapModalDraft) return;
    const d = mapModalDraft;
    if (
      !d.name.trim()
      || !d.phone.trim()
      || !d.street.trim()
      || !d.city.trim()
      || !d.state.trim()
      || !d.postalCode.trim()
      || !d.country.trim()
    ) {
      alert('Please fill all address fields.');
      return;
    }
    if (d.latitude === undefined || d.longitude === undefined) {
      alert('Please set your location on the map.');
      return;
    }
    if (!isDeliverable(d.postalCode.trim())) {
      alert('This pincode is not deliverable.');
      return;
    }
    setMapSaving(true);
    try {
      const updated = await addressesApi.update(mapModalAddress.id, {
        name: d.name.trim(),
        phone: d.phone.trim(),
        street: d.street.trim(),
        city: d.city.trim(),
        state: d.state.trim(),
        postalCode: d.postalCode.trim(),
        country: d.country.trim(),
        latitude: d.latitude,
        longitude: d.longitude,
      });
      setSavedAddresses((prev) =>
        prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)),
      );
      setMapModalAddress(null);
      setMapModalDraft(null);
    } catch (e) {
      alert((e as { message?: string })?.message || 'Could not save address.');
    } finally {
      setMapSaving(false);
    }
  };

  return (
    <div className={styles.pageWrap}>
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>Subscribe to {product.name}</h1>
          <div className={styles.priceInfoBlock}>
            <div className={styles.pricePill}>₹{product.pricePerLitre} per litre</div>
            {perLitreDiscount > 0 ? (
              <p className={styles.priceSaveText}>Save ₹{perLitreDiscount.toFixed(2)}</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={`${styles.field} ${styles.deliveryAddressField}`}>
            <label className={styles.label}>Delivery address</label>
            {loadingAddresses ? (
              <div className={styles.totalsBox}>
                <p className={styles.totalLine}>Loading saved addresses...</p>
              </div>
            ) : savedAddresses.length === 0 ? (
              <>
                <div className={styles.totalsBox}>
                  <p className={styles.totalLine}>No saved addresses found. Please add a new location.</p>
                </div>
                <button
                  type="button"
                  className={styles.addNewLocationBtn}
                  onClick={openAddLocationModal}
                >
                  <span className={styles.addNewLocationIcon} aria-hidden="true">+</span>
                  Add new location
                </button>
              </>
            ) : (
              <>
                <div className={styles.savedAddressesList}>
                  {visibleAddresses.map((address) => {
                    const hasPin =
                      typeof address.latitude === 'number' && typeof address.longitude === 'number';
                    return (
                      <div
                        key={address.id}
                        className={`${styles.savedAddressCardOuter} ${selectedAddressId === address.id ? styles.savedAddressCardOuterSelected : ''}`}
                      >
                        <label
                          className={`${styles.savedAddressCard} ${selectedAddressId === address.id ? styles.savedAddressCardSelected : ''}`}
                        >
                          <input
                            type="radio"
                            name="subscriptionAddress"
                            checked={selectedAddressId === address.id}
                            onChange={() => setSelectedAddressId(address.id)}
                            className={styles.addressRadio}
                          />
                          <div className={styles.savedAddressContent}>
                            <div className={styles.savedAddressHeader}>
                              <span className={styles.savedAddressName}>{address.name}</span>
                              {address.isDefault && <span className={styles.defaultBadge}>Default</span>}
                              {hasPin && (
                                <span className={styles.locationSavedBadge} title="Exact location saved">
                                  Map set
                                </span>
                              )}
                            </div>
                            <div className={styles.savedAddressDetails}>
                              <p>{address.street}</p>
                              <p>{address.city}, {address.state} {address.postalCode}</p>
                              <p>{address.country}</p>
                            </div>
                          </div>
                        </label>
                        <button
                          type="button"
                          className={styles.setExactLocationBtn}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            openMapModal(address);
                          }}
                        >
                          {hasPin ? 'Change Address' : 'Set address & map'}
                        </button>
                      </div>
                    );
                  })}
                </div>
                {hiddenAddressCount > 0 ? (
                  <p className={styles.hiddenAddressNote}>Non-delieverable address are hidden</p>
                ) : null}
                <button
                  type="button"
                  className={styles.addNewLocationBtn}
                  onClick={openAddLocationModal}
                >
                  <span className={styles.addNewLocationIcon} aria-hidden="true">+</span>
                  Add new location
                </button>
              </>
            )}
            <p className={styles.deliveryAddressFixedNote}>
              Delivery Address can&apos;t be changed once subscribed
            </p>
          </div>

          {pincodeStatus === 'missing' && (
            <div className={styles.totalsBox}>
              <p className={styles.totalLine}>
                Please choose a valid delivery address with a serviceable pincode.
              </p>
            </div>
          )}
          {pincodeStatus === 'unavailable' && (
            <div className={styles.totalsBox}>
              <p className={styles.totalLine}>
                Delivery is not available for pincode {savedPincode || 'selected'}.
              </p>
            </div>
          )}

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              {isCartFlow ? (
                <>
                  <label className={styles.labelInBorder} htmlFor="productSelect">
                    Product
                  </label>
                  <select
                    id="productSelect"
                    className={styles.select}
                    value={resolvedProductId}
                    onChange={(e) => setResolvedProductId(e.target.value)}
                    required
                  >
                    {cartFlowProducts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </>
              ) : null}
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="frequency">
                Frequency
              </label>
              <select
                id="frequency"
                className={styles.select}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as 'daily')}
                required
              >
                <option value="daily">Daily</option>
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="litresPerDay">
                Litres per day
              </label>
              <input
                id="litresPerDay"
                className={styles.input}
                type="number"
                min="1"
                max="10"
                value={litresPerDay}
                onChange={(e) => setLitresPerDay(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="durationMonths">
                Duration
              </label>
              <select
                id="durationMonths"
                className={styles.select}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                required
              >
                <option value={7}>7 days</option>
                <option value={15}>15 days</option>
                <option value={30}>1 month</option>
                <option value={60}>2 months</option>
                <option value={90}>3 months</option>
                <option value={180}>6 months</option>
                <option value={365}>12 months (365 days)</option>
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="deliveryTime">
                Delivery Time
              </label>
              <select
                id="deliveryTime"
                className={styles.select}
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
                required
              >
                {deliveryTimeOptions.map((slot) => (
                  <option key={slot.value} value={slot.value}>
                    {slot.label}
                  </option>
                ))}
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.totalsBox}>
            <p className={styles.totalLine}>
              Total per day: <strong>₹{product.pricePerLitre * litresPerDay}</strong>
            </p>
            <p className={styles.totalLine} style={{ marginTop: 8 }}>
              Total for {durationDays} day(s):{' '}
              <strong>₹{subscriptionTotal}</strong>
            </p>
            <p className={styles.amountBreakdown}>
              Breakdown: {litresPerDay} L/day × ₹{product.pricePerLitre}/L × {durationDays} day(s) = ₹{subscriptionTotal}
            </p>
          </div>

          {(!isCartFlow || isRenewFlow) && (
            <div className={`${styles.field} ${styles.paymentMethodField}`}>
              <label className={styles.label}>Payment method</label>
              <div className={styles.controlWrap} style={{ display: 'block' }}>
              <label className={styles.paymentMethodOption}>
                <input
                  type="radio"
                  name="subscriptionPaymentMethod"
                  value="online"
                  checked={paymentMethod === 'online'}
                  onChange={() => setPaymentMethod('online')}
                />
                <span className={styles.paymentMethodLabelWithIcon}>
                  <span className={styles.paymentInlineIcons} aria-hidden="true">
                    <svg className={styles.paymentBrandIcon} viewBox="0 -140 780 780" enableBackground="new 0 0 780 500" version="1.1" xmlSpace="preserve" xmlns="http://www.w3.org/2000/svg">
                      <path d="m293.2 348.73l33.359-195.76h53.358l-33.384 195.76h-53.333zm246.11-191.54c-10.569-3.966-27.135-8.222-47.821-8.222-52.726 0-89.863 26.551-90.181 64.604-0.297 28.129 26.515 43.822 46.754 53.185 20.771 9.598 27.752 15.716 27.652 24.283-0.133 13.123-16.586 19.115-31.924 19.115-21.355 0-32.701-2.967-50.225-10.273l-6.878-3.111-7.487 43.822c12.463 5.467 35.508 10.199 59.438 10.445 56.09 0 92.502-26.248 92.916-66.885 0.199-22.27-14.016-39.215-44.801-53.188-18.65-9.056-30.072-15.099-29.951-24.269 0-8.137 9.668-16.838 30.56-16.838 17.446-0.271 30.088 3.534 39.936 7.5l4.781 2.259 7.231-42.427m137.31-4.223h-41.23c-12.772 0-22.332 3.486-27.94 16.234l-79.245 179.4h56.031s9.159-24.121 11.231-29.418c6.123 0 60.555 0.084 68.336 0.084 1.596 6.854 6.492 29.334 6.492 29.334h49.512l-43.187-195.64zm-65.417 126.41c4.414-11.279 21.26-54.724 21.26-54.724-0.314 0.521 4.381-11.334 7.074-18.684l3.606 16.878s10.217 46.729 12.353 56.527h-44.293v3e-3zm-363.3-126.41l-52.239 133.5-5.565-27.129c-9.726-31.274-40.025-65.157-73.898-82.12l47.767 171.2 56.455-0.063 84.004-195.39-56.524-1e-3" fill="#0E4595"></path>
                      <path d="m146.92 152.96h-86.041l-0.682 4.073c66.939 16.204 111.23 55.363 129.62 102.42l-18.709-89.96c-3.229-12.396-12.597-16.096-24.186-16.528" fill="#F2AE14"></path>
                    </svg>
                    <svg className={styles.paymentBrandIcon} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <g fill="none" fillRule="evenodd">
                        <circle cx="7" cy="12" r="7" fill="#EA001B"></circle>
                        <circle cx="17" cy="12" r="7" fill="#FFA200" fillOpacity=".8"></circle>
                      </g>
                    </svg>
                    <span className={styles.paymentEtc}>etc</span>
                  </span>
                  <span>Pay full amount online (₹{subscriptionTotal.toFixed(2)})</span>
                </span>
              </label>

              {walletBalance > 0 && (
                <label className={styles.paymentMethodOption}>
                  <input
                    type="radio"
                    name="subscriptionPaymentMethod"
                    value="wallet"
                    checked={paymentMethod === 'wallet'}
                    onChange={() => setPaymentMethod('wallet')}
                  />
                  <span className={styles.paymentMethodLabelWithIcon}>
                    <span className={styles.walletIconWrap} aria-hidden="true">
                      <svg className={styles.walletIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a3 3 0 0 1 3 3v1h-6.5A2.5 2.5 0 0 0 12 11.5v1A2.5 2.5 0 0 0 14.5 15H21v1a3 3 0 0 1-3 3H5.5A2.5 2.5 0 0 1 3 16.5v-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 10h-6.5a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5H21v-4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="16.5" cy="12" r="0.9" fill="currentColor" />
                      </svg>
                    </span>
                    <span>
                    {onlineDuePreview > 0
                      ? `Use your wallet to pay ₹${walletUsedPreview.toFixed(2)} + ₹${onlineDuePreview.toFixed(2)} through online`
                      : `Use your wallet to pay ₹${walletUsedPreview.toFixed(2)}`}
                    </span>
                  </span>
                </label>
              )}
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting || ((!isCartFlow || isRenewFlow) && pincodeStatus !== 'available')} className={`${styles.button} ${styles.submitBottomBtn}`}>
            {submitting ? 'Processing...' : isCartFlow ? (isRenewFlow ? 'Proceed to Payment' : 'Add to cart') : pincodeStatus === 'missing' ? 'Add Pincode to Continue' : pincodeStatus === 'unavailable' ? 'Pincode Not Deliverable' : 'Proceed to Payment'}
          </button>
          <div className={styles.termsConsent}>
            By clicking, you agree to{' '}
            <Link href="/terms" className={styles.termsLink}>
              Terms &amp; Condition
            </Link>
          </div>
        </form>

        {mapModalAddress && mapModalDraft ? (
          <div
            className={styles.mapModalOverlay}
            role="presentation"
            onClick={() => closeMapModal()}
          >
            <div
              className={styles.mapModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="subscribe-address-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.mapModalClose}
                aria-label="Close"
                disabled={mapSaving}
                onClick={() => closeMapModal()}
              >
                ×
              </button>
              <h3 id="subscribe-address-modal-title" className={styles.mapModalTitle}>
                Delivery address
              </h3>
              <p className={styles.mapModalSubtitle}>
                Update your details and map pin. Changes apply when you save.
              </p>
              <div className={styles.addLocationForm}>
                <div className={styles.addLocationRow}>
                  <input
                    className={styles.input}
                    placeholder="Full name"
                    value={mapModalDraft.name}
                    onChange={(e) => setMapModalDraft((p) => (p ? { ...p, name: e.target.value } : p))}
                  />
                  <input
                    className={styles.input}
                    placeholder="Phone number"
                    value={mapModalDraft.phone}
                    onChange={(e) => setMapModalDraft((p) => (p ? { ...p, phone: e.target.value } : p))}
                  />
                </div>
                <input
                  className={styles.input}
                  placeholder="Street address"
                  value={mapModalDraft.street}
                  onChange={(e) => setMapModalDraft((p) => (p ? { ...p, street: e.target.value } : p))}
                />
                <div className={styles.addLocationRow}>
                  <input
                    className={styles.input}
                    placeholder="City"
                    value={mapModalDraft.city}
                    onChange={(e) => setMapModalDraft((p) => (p ? { ...p, city: e.target.value } : p))}
                  />
                  <input
                    className={styles.input}
                    placeholder="State"
                    value={mapModalDraft.state}
                    onChange={(e) => setMapModalDraft((p) => (p ? { ...p, state: e.target.value } : p))}
                  />
                </div>
                <div className={styles.addLocationRow}>
                  <input
                    className={styles.input}
                    placeholder="Postal code"
                    value={mapModalDraft.postalCode}
                    onChange={(e) => setMapModalDraft((p) => (p ? { ...p, postalCode: e.target.value } : p))}
                  />
                  <input
                    className={styles.input}
                    value="India"
                    readOnly
                    aria-label="Country (fixed)"
                  />
                </div>
                <div className={styles.mapModalBody}>
                  <AddressLocationPicker
                    key={mapModalAddress.id}
                    latitude={mapModalDraft.latitude}
                    longitude={mapModalDraft.longitude}
                    showCoords={false}
                    onChange={({ latitude, longitude }) =>
                      setMapModalDraft((p) => (p ? { ...p, latitude, longitude } : p))
                    }
                  />
                </div>
              </div>
              <div className={styles.mapModalActions}>
                <button
                  type="button"
                  className={styles.mapModalCancel}
                  disabled={mapSaving}
                  onClick={() => closeMapModal()}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.mapModalSave}
                  disabled={mapSaving}
                  onClick={() => void saveAddressFromMapModal()}
                >
                  {mapSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showAddLocationModal ? (
          <div className={styles.mapModalOverlay} role="presentation" onClick={closeAddLocationModal}>
            <div
              className={styles.mapModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="add-location-title"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className={styles.mapModalClose}
                aria-label="Close"
                disabled={creatingAddress}
                onClick={closeAddLocationModal}
              >
                ×
              </button>
              <h3 id="add-location-title" className={styles.mapModalTitle}>Add new location</h3>
              <p className={styles.mapModalSubtitle}>Enter delivery address details</p>
              <div className={styles.addLocationForm}>
                <div className={styles.addLocationRow}>
                  <input
                    className={styles.input}
                    placeholder="Full name"
                    value={newAddressForm.name}
                    onChange={(e) => setNewAddressForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className={styles.input}
                    placeholder="Phone number"
                    value={newAddressForm.phone}
                    onChange={(e) => setNewAddressForm((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
                <input
                  className={styles.input}
                  placeholder="Street address"
                  value={newAddressForm.street}
                  onChange={(e) => setNewAddressForm((p) => ({ ...p, street: e.target.value }))}
                />
                <div className={styles.addLocationRow}>
                  <input
                    className={styles.input}
                    placeholder="City"
                    value={newAddressForm.city}
                    onChange={(e) => setNewAddressForm((p) => ({ ...p, city: e.target.value }))}
                  />
                  <input
                    className={styles.input}
                    placeholder="State"
                    value={newAddressForm.state}
                    onChange={(e) => setNewAddressForm((p) => ({ ...p, state: e.target.value }))}
                  />
                </div>
                <div className={styles.addLocationRow}>
                  <input
                    className={styles.input}
                    placeholder="Postal code"
                    value={newAddressForm.postalCode}
                    onChange={(e) => setNewAddressForm((p) => ({ ...p, postalCode: e.target.value }))}
                  />
                  <input
                    className={styles.input}
                    value="India"
                    readOnly
                    aria-label="Country (fixed)"
                  />
                </div>
                <AddressLocationPicker
                  latitude={newAddressForm.latitude}
                  longitude={newAddressForm.longitude}
                  showCoords={false}
                  onChange={({ latitude, longitude }) =>
                    setNewAddressForm((p) => ({ ...p, latitude, longitude }))
                  }
                />
              </div>
              <div className={styles.mapModalActions}>
                <button
                  type="button"
                  className={styles.mapModalCancel}
                  disabled={creatingAddress}
                  onClick={closeAddLocationModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.mapModalSave}
                  disabled={creatingAddress}
                  onClick={() => void createAddressFromModal()}
                >
                  {creatingAddress ? 'Saving…' : 'Save location'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {showSuccessModal ? (
          <div
            className={styles.mapModalOverlay}
            role="presentation"
          >
            <div
              className={styles.successModal}
              role="dialog"
              aria-modal="true"
              aria-labelledby="subscription-success-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.successIconWrap} aria-hidden="true">
                <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.successIcon}>
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M252.644 56.915C295.342 38.4482 320.69 113.363 271.651 123.522C231.551 131.832 216.845 78.0154 247.144 58.0544" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M330.482 265.712C341.911 277.397 345.967 295.564 330.334 311.241C305.977 335.671 271.834 312.649 271.756 285.037" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M192.293 285.199C193.35 293.668 190.602 302.807 182.127 311.229C159.576 333.641 128.721 316.163 123.655 291.812" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M231 133C206.612 161.128 194.495 179.606 187 209" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M231.268 139C230.078 174.935 230.842 200.382 278 181.706" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M270.454 181.27C277.648 203.747 292.95 234.179 296.436 257.918" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M198.698 209.851C179.8 211.119 147.038 219.427 133.916 234.11C126.125 242.825 100.697 270.714 108.106 285.446C112.07 293.339 163.502 289.662 170.276 288.7C200.718 284.374 240.691 289.662 270.337 285.446C276.764 284.532 267.42 277.198 275.865 277.198C288.469 277.198 350.064 262.896 339.366 250.123C314.559 220.523 257.393 244.451 266.097 274.746" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M200.303 212.449C207.9 229.886 214.057 274.576 214.593 278.703" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M200.303 208.553C255.045 208.309 257.332 233.927 223.294 274.806" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M169.124 213.748C142.024 230.768 99.6067 221.459 67.7939 231.936" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M60 128.007C68.4342 143.576 60 224.334 63.5625 228.038" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M63.8965 128.233C105.69 123.275 132.857 122.22 136.014 128.233C139.17 134.247 139.17 171.658 130.567 218.945" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
              </div>
              <h3 id="subscription-success-title" className={styles.successTitle}>All Done!</h3>
              <p className={styles.successText}>
                Your {product.name} subscription has been successfully activated.
                <br />
                We&apos;ll start delivering fresh {product.name} to your doorstep as per your selected schedule.
              </p>
              <button
                type="button"
                className={styles.successBtn}
                onClick={() => router.push('/subscriptions')}
              >
                View
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
