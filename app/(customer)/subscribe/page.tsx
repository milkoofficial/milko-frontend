'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams, useRouter } from 'next/navigation';
import { productsApi, subscriptionsApi, contentApi, walletApi, addressesApi, apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  readScopedPincode,
  scopedPincodeKey,
  scopedPincodeStatusKey,
  writeSubscriptionCartJson,
} from '@/lib/utils/userScopedStorage';
import { Product, Address, ProductVariation } from '@/types';
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
  
  const queryProductId = searchParams.get('productId');
  const queryVariationId = searchParams.get('variationId');
  const isCartFlow = searchParams.get('from') === 'cart';
  const isRenewFlow = searchParams.get('renew') === '1';

  const [product, setProduct] = useState<Product | null>(null);
  const [variationId, setVariationId] = useState<string | null>(queryVariationId);
  const [resolvedProductId, setResolvedProductId] = useState(queryProductId || '');
  
  const [eligibleProducts, setEligibleProducts] = useState<Product[]>([]);
  const [quantityPerDay, setQuantityPerDay] = useState(1);
  const [frequency, setFrequency] = useState<'daily'>('daily');
  const [durationDays, setDurationDays] = useState(30);
  const [deliveryTime, setDeliveryTime] = useState(DEFAULT_DELIVERY_TIME_OPTIONS[0].value);
  const [deliveryTimeOptions, setDeliveryTimeOptions] = useState<Array<{ label: string; value: string }>>(DEFAULT_DELIVERY_TIME_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'wallet'>('online');
  const [walletBalance, setWalletBalance] = useState(0);
  const [platformFee, setPlatformFee] = useState(0);
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

  // Load all eligible products for the dropdown
  useEffect(() => {
    const fetchEligible = async () => {
      try {
        const all = await productsApi.getAll();
        const filtered = all.filter((p) => p.isActive !== false && p.isMembershipEligible);
        
        // Fetch full details (variations) for each eligible product
        const detailed = await Promise.all(
          filtered.map(async (p) => {
            try {
              return await productsApi.getById(p.id, true);
            } catch {
              return p;
            }
          })
        );
        setEligibleProducts(detailed);

        // Initial setup from query params
        if (queryProductId) {
          const found = detailed.find(p => p.id === queryProductId);
          if (found) {
            setProduct(found);
            setResolvedProductId(found.id);
            setVariationId(queryVariationId);
          } else if (detailed.length > 0) {
            setProduct(detailed[0]);
            setResolvedProductId(detailed[0].id);
          }
        } else if (detailed.length > 0) {
          setProduct(detailed[0]);
          setResolvedProductId(detailed[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch eligible products:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEligible();
  }, [queryProductId, queryVariationId]);

  // Sync state from query params once
  useEffect(() => {
    const litersParam = searchParams.get('liters');
    const daysParam = searchParams.get('days');
    const monthsParam = searchParams.get('months');
    const frequencyParam = searchParams.get('frequency');
    
    if (litersParam) setQuantityPerDay(Math.max(1, Math.floor(parseFloat(litersParam) || 1)));
    if (monthsParam) {
      setDurationDays(parseInt(monthsParam, 10) * 30);
    } else if (daysParam) {
      setDurationDays(parseInt(daysParam, 10));
    }
    if (frequencyParam === 'daily') setFrequency(frequencyParam);
  }, [searchParams]);

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
    let cancelled = false;
    const loadPlatformFee = async () => {
      try {
        const data = await contentApi.getByType('platform_fee');
        const metadataAmount = Number(data.metadata?.amount);
        const titleAmount = Number(data.title);
        const amount = Number.isFinite(metadataAmount) ? metadataAmount : titleAmount;
        if (!cancelled) setPlatformFee(Number.isFinite(amount) && amount > 0 ? amount : 0);
      } catch {
        if (!cancelled) setPlatformFee(0);
      }
    };
    loadPlatformFee();
    return () => { cancelled = true; };
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
      if (e.key === scopedPincodeKey(pinUserId) || e.key === scopedPincodeStatusKey(pinUserId)) syncPincodeState();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [savedAddresses, selectedAddressId, pinUserId]);

  const selectedVariation = useMemo(() => {
    if (!product || !variationId) return null;
    return (product.variations || []).find(v => v.id === variationId) || null;
  }, [product, variationId]);

  const maxSubscriptionQuantity = useMemo(() => {
    const rawLimit = Number(product?.maxQuantity);
    return Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.max(1, Math.floor(rawLimit)) : 10;
  }, [product?.maxQuantity]);

  useEffect(() => {
    setQuantityPerDay((prev) => Math.min(Math.max(1, Math.floor(prev || 1)), maxSubscriptionQuantity));
  }, [maxSubscriptionQuantity]);

  const quantityOptions = useMemo(
    () => Array.from({ length: maxSubscriptionQuantity }, (_, index) => index + 1),
    [maxSubscriptionQuantity],
  );

  const basePricePerLitre = useMemo(() => {
    if (!product) return 0;
    if (selectedVariation) {
      const vPrice = selectedVariation.price ?? (product.pricePerLitre * (selectedVariation.priceMultiplier || 1));
      return vPrice / (selectedVariation.priceMultiplier || 1);
    }
    return product.pricePerLitre;
  }, [product, selectedVariation]);

  const subscriptionTotal = useMemo(() => {
    return basePricePerLitre * quantityPerDay * durationDays;
  }, [basePricePerLitre, quantityPerDay, durationDays]);
  const initialPaymentPlatformFee = platformFee;
  const payableTodayTotal = Math.max(0, Math.round((subscriptionTotal + initialPaymentPlatformFee) * 100) / 100);
  const walletUsedPreview = Math.max(0, Math.min(walletBalance, payableTodayTotal));
  const onlineDuePreview = Math.max(0, Math.round((payableTodayTotal - walletUsedPreview) * 100) / 100);

  const handleProductChange = (val: string) => {
    const [pid, vid] = val.split('::');
    setResolvedProductId(pid);
    setVariationId(vid || null);
    const found = eligibleProducts.find(p => p.id === pid);
    if (found) setProduct(found);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedProductId || !product) return;

    if (isCartFlow && !isRenewFlow) {
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
        variationId: variationId || undefined,
        productName: product.name,
        litresPerDay: quantityPerDay,
        durationDays,
        durationMonths,
        deliveryTime,
        paymentMethod,
        totalAmount: Number(subscriptionTotal.toFixed(2)),
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
    if (pincodeStatus !== 'available') return;

    setSubmitting(true);
    let openedRazorpay = false;
    try {
      const durationMonths = Math.max(1, Math.round(durationDays / 30));
      const result = await subscriptionsApi.create({
        productId: resolvedProductId,
        variationId: variationId || undefined,
        variation_id: variationId || undefined,
        productVariationId: variationId || undefined,
        product_variation_id: variationId || undefined,
        litresPerDay: quantityPerDay,
        frequency: frequency as any,
        durationDays,
        durationMonths,
        deliveryTime,
        paymentMethod,
        addressId: selectedAddressId || undefined,
        totalAmount: payableTodayTotal,
        total_amount: payableTodayTotal,
        amount: payableTodayTotal,
      });

      if (!result.razorpayOrder || !result.razorpayOrder.id) {
        setShowSuccessModal(true);
        return;
      }

      const loadRazorpayScript = (): Promise<void> => {
        if (typeof window !== 'undefined' && (window as any).Razorpay) return Promise.resolve();
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
      const Razorpay = (window as any).Razorpay;
      const rzp = new Razorpay({
        key: result.razorpayOrder.key,
        order_id: result.razorpayOrder.id,
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
        modal: { ondismiss: () => setSubmitting(false) },
      });
      openedRazorpay = true;
      rzp.open();
    } catch (error) {
      console.error('Failed to create subscription:', error);
      alert((error as any)?.message || 'Failed to create subscription.');
    } finally {
      if (!openedRazorpay) setSubmitting(false);
    }
  };

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
    if (!newAddressForm.name.trim() || !newAddressForm.phone.trim() || !newAddressForm.street.trim() || !newAddressForm.city.trim() || !newAddressForm.state.trim() || !newAddressForm.postalCode.trim()) {
      alert('Please fill all fields.'); return;
    }
    if (newAddressForm.latitude === undefined || newAddressForm.longitude === undefined) {
      alert('Please set location on map.'); return;
    }
    if (!isDeliverable(newAddressForm.postalCode.trim())) {
      alert('Pincode not deliverable.'); return;
    }
    setCreatingAddress(true);
    try {
      const created = await addressesApi.create({ ...newAddressForm, isDefault: savedAddresses.length === 0 });
      const addresses = await addressesApi.getAll();
      setSavedAddresses(addresses);
      setSelectedAddressId(created.id);
      setShowAddLocationModal(false);
    } catch (e) {
      alert((e as any)?.message || 'Failed to add location');
    } finally {
      setCreatingAddress(false);
    }
  };

  const saveAddressFromMapModal = async () => {
    if (!mapModalAddress || !mapModalDraft) return;
    const d = mapModalDraft;
    if (!d.name.trim() || !d.phone.trim() || !d.street.trim() || !d.city.trim() || !d.state.trim() || !d.postalCode.trim()) {
      alert('Please fill all fields.'); return;
    }
    if (d.latitude === undefined || d.longitude === undefined) {
      alert('Please set location on map.'); return;
    }
    if (!isDeliverable(d.postalCode.trim())) {
      alert('Pincode not deliverable.'); return;
    }
    setMapSaving(true);
    try {
      const updated = await addressesApi.update(mapModalAddress.id, { ...d });
      setSavedAddresses((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
      setMapModalAddress(null);
      setMapModalDraft(null);
    } catch (e) {
      alert((e as any)?.message || 'Could not save address.');
    } finally {
      setMapSaving(false);
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  if (!product) return <div style={{ padding: '2rem', textAlign: 'center' }}>Product not found</div>;

  const perLitreDiscount = Math.max(0, (product.compareAtPrice ?? product.sellingPrice ?? 0) - basePricePerLitre);
  const visibleAddresses = savedAddresses.filter((a) => isDeliverable((a.postalCode || '').trim()));
  const hiddenAddressCount = Math.max(0, savedAddresses.length - visibleAddresses.length);

  const dropdownValue = `${resolvedProductId}${variationId ? `::${variationId}` : ''}`;

  return (
    <div className={styles.pageWrap}>
      <div className={styles.card}>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>
            Subscribe to {product.name} {selectedVariation ? `[${selectedVariation.size}]` : ''}
          </h1>
          <div className={styles.priceInfoBlock}>
            <div className={styles.pricePill}>₹{basePricePerLitre} per litre</div>
            {perLitreDiscount > 0 ? (
              <p className={styles.priceSaveText}>Save ₹{perLitreDiscount.toFixed(2)}</p>
            ) : null}
          </div>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="productSelect">Select Product</label>
              <select
                id="productSelect"
                className={styles.select}
                value={dropdownValue}
                onChange={(e) => handleProductChange(e.target.value)}
                required
              >
                {eligibleProducts.flatMap((p) => {
                  if (p.variations && p.variations.length > 0) {
                    return p.variations.map((v) => {
                      const vPrice = v.price ?? (p.pricePerLitre * (v.priceMultiplier || 1));
                      return (
                        <option key={`${p.id}::${v.id}`} value={`${p.id}::${v.id}`}>
                          {p.name} [{v.size} - ₹{vPrice}]
                        </option>
                      );
                    });
                  }
                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} [1L - ₹{p.pricePerLitre}]
                    </option>
                  );
                })}
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={`${styles.field} ${styles.deliveryAddressField}`}>
            <label className={styles.label}>Delivery address</label>
            {loadingAddresses ? (
              <div className={styles.totalsBox}><p className={styles.totalLine}>Loading saved addresses...</p></div>
            ) : savedAddresses.length === 0 ? (
              <>
                <div className={styles.totalsBox}><p className={styles.totalLine}>No saved addresses found. Please add a new location.</p></div>
                <button type="button" className={styles.addNewLocationBtn} onClick={openAddLocationModal}><span className={styles.addNewLocationIcon}>+</span>Add new location</button>
              </>
            ) : (
              <>
                <div className={styles.savedAddressesList}>
                  {visibleAddresses.map((address) => {
                    const hasPin = typeof address.latitude === 'number' && typeof address.longitude === 'number';
                    return (
                      <div key={address.id} className={`${styles.savedAddressCardOuter} ${selectedAddressId === address.id ? styles.savedAddressCardOuterSelected : ''}`}>
                        <label className={`${styles.savedAddressCard} ${selectedAddressId === address.id ? styles.savedAddressCardSelected : ''}`}>
                          <input type="radio" name="subscriptionAddress" checked={selectedAddressId === address.id} onChange={() => setSelectedAddressId(address.id)} className={styles.addressRadio} />
                          <div className={styles.savedAddressContent}>
                            <div className={styles.savedAddressHeader}>
                              <span className={styles.savedAddressName}>{address.name}</span>
                              {address.isDefault && <span className={styles.defaultBadge}>Default</span>}
                              {hasPin && <span className={styles.locationSavedBadge}>Map set</span>}
                            </div>
                            <div className={styles.savedAddressDetails}><p>{address.street}</p><p>{address.city}, {address.state} {address.postalCode}</p></div>
                          </div>
                        </label>
                        <button type="button" className={styles.setExactLocationBtn} onClick={() => openMapModal(address)}>{hasPin ? 'Change Address' : 'Set address & map'}</button>
                      </div>
                    );
                  })}
                </div>
                {hiddenAddressCount > 0 && <p className={styles.hiddenAddressNote}>Non-delieverable address are hidden</p>}
                <button type="button" className={styles.addNewLocationBtn} onClick={openAddLocationModal}><span className={styles.addNewLocationIcon}>+</span>Add new location</button>
              </>
            )}
            <p className={styles.deliveryAddressFixedNote}>Delivery Address can&apos;t be changed once subscribed</p>
          </div>

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="frequency">Frequency</label>
              <select id="frequency" className={styles.select} value={frequency} onChange={() => setFrequency('daily')} required>
                <option value="daily">Daily</option>
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="quantityPerDay">Quantity</label>
              <select
                id="quantityPerDay"
                className={styles.select}
                value={quantityPerDay}
                onChange={(e) => setQuantityPerDay(Number(e.target.value))}
                required
              >
                {quantityOptions.map((qty) => (
                  <option key={qty} value={qty}>
                    {qty}
                  </option>
                ))}
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="durationDays">Duration</label>
              <select id="durationDays" className={styles.select} value={durationDays} onChange={(e) => setDurationDays(Number(e.target.value))} required>
                <option value={7}>7 days</option>
                <option value={15}>15 days</option>
                <option value={30}>1 month</option>
                <option value={60}>2 months</option>
                <option value={90}>3 months</option>
                <option value={180}>6 months</option>
                <option value={365}>1 year</option>
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.field}>
            <div className={styles.controlWrap}>
              <label className={styles.labelInBorder} htmlFor="deliveryTime">Delivery Time</label>
              <select id="deliveryTime" className={styles.select} value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} required>
                {deliveryTimeOptions.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
              </select>
              <svg className={styles.selectArrow} viewBox="0 0 24 24" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          <div className={styles.totalsBox}>
            <p className={styles.totalLine}>Total per day: <strong>₹{(basePricePerLitre * quantityPerDay).toFixed(2)}</strong></p>
            <p className={styles.totalLine} style={{ marginTop: 8 }}>Total for {durationDays} day(s): <strong>₹{subscriptionTotal.toFixed(2)}</strong></p>
            {initialPaymentPlatformFee > 0 && <p className={styles.totalLine} style={{ marginTop: 8 }}>Platform fee: <strong>₹{initialPaymentPlatformFee.toFixed(2)}</strong></p>}
            <p className={styles.totalLine} style={{ marginTop: 8 }}>Payable today: <strong>₹{payableTodayTotal.toFixed(2)}</strong></p>
            <p className={styles.amountBreakdown}>
              Breakdown: {quantityPerDay} qty/day × ₹{basePricePerLitre.toFixed(2)} × {durationDays} days
              {initialPaymentPlatformFee > 0 ? ` + ₹${initialPaymentPlatformFee.toFixed(2)} (Platform Fee)` : ''} 
              = ₹{payableTodayTotal.toFixed(2)}
            </p>
          </div>

          {(!isCartFlow || isRenewFlow) && (
            <div className={`${styles.field} ${styles.paymentMethodField}`}>
              <label className={styles.label}>Payment method</label>
              <div className={styles.controlWrap}>
                <label className={styles.paymentMethodOption}>
                  <input type="radio" name="subscriptionPaymentMethod" value="online" checked={paymentMethod === 'online'} onChange={() => setPaymentMethod('online')} />
                  <span className={styles.paymentMethodLabelWithIcon}>Pay full amount online (₹{payableTodayTotal.toFixed(2)})</span>
                </label>
                {walletBalance > 0 && (
                  <label className={styles.paymentMethodOption}>
                    <input type="radio" name="subscriptionPaymentMethod" value="wallet" checked={paymentMethod === 'wallet'} onChange={() => setPaymentMethod('wallet')} />
                    <span className={styles.paymentMethodLabelWithIcon}>
                      {onlineDuePreview > 0 ? `Use wallet ₹${walletUsedPreview.toFixed(2)} + ₹${onlineDuePreview.toFixed(2)} online` : `Use wallet ₹${walletUsedPreview.toFixed(2)}`}
                    </span>
                  </label>
                )}
              </div>
            </div>
          )}

          <button type="submit" disabled={submitting || ((!isCartFlow || isRenewFlow) && pincodeStatus !== 'available')} className={`${styles.button} ${styles.submitBottomBtn}`}>
            {submitting ? 'Processing...' : isCartFlow ? (isRenewFlow ? 'Proceed to Payment' : 'Add to cart') : 'Proceed to Payment'}
          </button>
        </form>

        {mapModalAddress && mapModalDraft && (
          <div className={styles.mapModalOverlay} onClick={closeMapModal}>
            <div className={styles.mapModal} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.mapModalClose} onClick={closeMapModal}>×</button>
              <h3 className={styles.mapModalTitle}>Delivery address</h3>
              <div className={styles.addLocationForm}>
                <div className={styles.addLocationRow}>
                  <input className={styles.input} placeholder="Name" value={mapModalDraft.name} onChange={(e) => setMapModalDraft(p => p ? { ...p, name: e.target.value } : p)} />
                  <input className={styles.input} placeholder="Phone" value={mapModalDraft.phone} onChange={(e) => setMapModalDraft(p => p ? { ...p, phone: e.target.value } : p)} />
                </div>
                <input className={styles.input} placeholder="Street" value={mapModalDraft.street} onChange={(e) => setMapModalDraft(p => p ? { ...p, street: e.target.value } : p)} />
                <div className={styles.addLocationRow}>
                  <input className={styles.input} placeholder="City" value={mapModalDraft.city} onChange={(e) => setMapModalDraft(p => p ? { ...p, city: e.target.value } : p)} />
                  <input className={styles.input} placeholder="State" value={mapModalDraft.state} onChange={(e) => setMapModalDraft(p => p ? { ...p, state: e.target.value } : p)} />
                </div>
                <input className={styles.input} placeholder="Postal code" value={mapModalDraft.postalCode} onChange={(e) => setMapModalDraft(p => p ? { ...p, postalCode: e.target.value } : p)} />
                <AddressLocationPicker latitude={mapModalDraft.latitude} longitude={mapModalDraft.longitude} onChange={({ latitude, longitude }) => setMapModalDraft(p => p ? { ...p, latitude, longitude } : p)} />
              </div>
              <div className={styles.mapModalActions}>
                <button type="button" className={styles.mapModalCancel} onClick={closeMapModal}>Cancel</button>
                <button type="button" className={styles.mapModalSave} disabled={mapSaving} onClick={saveAddressFromMapModal}>{mapSaving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {showAddLocationModal && (
          <div className={styles.mapModalOverlay} onClick={closeAddLocationModal}>
            <div className={styles.mapModal} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.mapModalClose} onClick={closeAddLocationModal}>×</button>
              <h3 className={styles.mapModalTitle}>Add location</h3>
              <div className={styles.addLocationForm}>
                <div className={styles.addLocationRow}>
                  <input className={styles.input} placeholder="Name" value={newAddressForm.name} onChange={(e) => setNewAddressForm(p => ({ ...p, name: e.target.value }))} />
                  <input className={styles.input} placeholder="Phone" value={newAddressForm.phone} onChange={(e) => setNewAddressForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <input className={styles.input} placeholder="Street" value={newAddressForm.street} onChange={(e) => setNewAddressForm(p => ({ ...p, street: e.target.value }))} />
                <div className={styles.addLocationRow}>
                  <input className={styles.input} placeholder="City" value={newAddressForm.city} onChange={(e) => setNewAddressForm(p => ({ ...p, city: e.target.value }))} />
                  <input className={styles.input} placeholder="State" value={newAddressForm.state} onChange={(e) => setNewAddressForm(p => ({ ...p, state: e.target.value }))} />
                </div>
                <input className={styles.input} placeholder="Postal code" value={newAddressForm.postalCode} onChange={(e) => setNewAddressForm(p => ({ ...p, postalCode: e.target.value }))} />
                <AddressLocationPicker latitude={newAddressForm.latitude} longitude={newAddressForm.longitude} onChange={({ latitude, longitude }) => setNewAddressForm(p => ({ ...p, latitude, longitude }))} />
              </div>
              <div className={styles.mapModalActions}>
                <button type="button" className={styles.mapModalCancel} onClick={closeAddLocationModal}>Cancel</button>
                <button type="button" className={styles.mapModalSave} disabled={creatingAddress} onClick={createAddressFromModal}>{creatingAddress ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        )}

        {showSuccessModal && product && (
          <div className={styles.mapModalOverlay}>
            <div className={styles.successModal}>
              <h3 className={styles.successTitle}>Subscription Active!</h3>
              <p className={styles.successText}>Your {product.name} {selectedVariation ? `[${selectedVariation.size}]` : ''} subscription is active.</p>
              <button type="button" className={styles.successBtn} onClick={() => router.push('/subscriptions')}>View Subscriptions</button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.trialCard}>
        <h2 className={styles.trialCardTitle}>Not Ready for a Full Subscription??</h2>
        <p className={styles.trialCardText}>
          Start with our Trial Pack and experience the quality before committing to a full plan.
        </p>
        <Link href="/get-trial-pack" className={styles.trialCardButton}>
          Grab Trial Pack
        </Link>
      </div>
    </div>
  );
}
