'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, type CSSProperties } from 'react';
import { Product, ProductVariation, ProductReview } from '@/types';
import { productsApi, contentApi } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import {
  readScopedPincode,
  scopedPincodeKey,
  scopedPincodeStatusKey,
  writeScopedPincode,
} from '@/lib/utils/userScopedStorage';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import Image from 'next/image';
import Link from 'next/link';
import styles from './ProductDetailsModal.module.css';
import howWasItStyles from './HowWasItModal.module.css';
import RatingBadge from '@/components/ui/RatingBadge';
import { toSafeHtml } from '@/lib/utils/sanitizeHtml';
import { getOrderedProductImageUrls } from '@/lib/utils/productImages';

interface ProductDetailsModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onRelatedProductClick?: (product: Product) => void;
}

/**
 * Product Details Modal Component
 * Shows detailed product information in a beautiful animated popup
 */
export default function ProductDetailsModal({ product, isOpen, onClose, onRelatedProductClick }: ProductDetailsModalProps) {
  const { addItem } = useCart();
  const { user } = useAuth();
  const pinUserId = user?.id ?? null;
  const { showToast } = useToast();
  const addToCartButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [productDetails, setProductDetails] = useState<Product | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariationId, setSelectedVariationId] = useState<string | null>(null);
  const [pincode, setPincode] = useState('');
  const [showDeliveryInfo, setShowDeliveryInfo] = useState(false);
  const [isPincodeAvailable, setIsPincodeAvailable] = useState<boolean | null>(null);
  const [isCheckingPincode, setIsCheckingPincode] = useState(false);
  const [serviceablePincodes, setServiceablePincodes] = useState<Array<{ pincode: string; deliveryTime?: string }> | null>(null);
  
  // Swipe/drag (desktop) + touch via native listeners on mainImageRef (avoids stale state / passive)
  const [mouseStart, setMouseStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mainImageRef = useRef<HTMLDivElement>(null);
  const collageLenRef = useRef(0);
  const didSwipeRef = useRef(false);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const zoomScaleRef = useRef(1);
  zoomScaleRef.current = zoomScale;
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null);

  type ZoomOrigin = {
    tcx: number;
    tcy: number;
    s0: number;
    finalW: number;
    finalH: number;
    vw: number;
    vh: number;
  };
  const [zoomOrigin, setZoomOrigin] = useState<ZoomOrigin | null>(null);
  const [zoomAnimToCenter, setZoomAnimToCenter] = useState(false);
  
  // Membership subscription state
  const [showMembershipDetails, setShowMembershipDetails] = useState(false);
  const [membershipFrequency, setMembershipFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'quarterly'>('daily');
  const [membershipQuantity, setMembershipQuantity] = useState('1');
  const [membershipDuration, setMembershipDuration] = useState('30');
  const [showRatingDetailsPopup, setShowRatingDetailsPopup] = useState(false);

  const isDeliverable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (cleaned.length !== 6) return false;
    if (!serviceablePincodes || serviceablePincodes.length === 0) return true;
    return serviceablePincodes.some((e) => (typeof e === 'string' ? e : e.pincode) === cleaned);
  };

  // Reset membership form when modal closes or product changes
  useEffect(() => {
    if (!isOpen) {
      setShowMembershipDetails(false);
      setMembershipFrequency('daily');
      setMembershipQuantity('1');
      setMembershipDuration('30');
    }
  }, [isOpen, product.id]);

  // Load pincode config + saved pincode when modal opens
  useEffect(() => {
    if (isOpen) {
      // Fetch serviceable pincode(s) from admin-configured site content
      (async () => {
        try {
          const cfg = await contentApi.getByType('pincodes');
          const meta = (cfg?.metadata || {}) as any;
          let list: Array<{ pincode: string; deliveryTime?: string }> = [];
          if (Array.isArray(meta.serviceablePincodes)) {
            list = meta.serviceablePincodes.map((el: any) =>
              typeof el === 'string'
                ? { pincode: el.trim(), deliveryTime: '1h' }
                : { pincode: (el.pincode || el).toString().trim(), deliveryTime: (el.deliveryTime || '1h')?.toString() || '1h' }
            ).filter((x: { pincode: string }) => x.pincode.length === 6);
          } else if (typeof meta.serviceablePincode === 'string' && meta.serviceablePincode.trim()) {
            list = [{ pincode: meta.serviceablePincode.trim(), deliveryTime: '1h' }];
          }
          setServiceablePincodes(list.length > 0 ? list : null);
        } catch {
          // No config -> allow all
          setServiceablePincodes(null);
        }
      })();

      const savedPincode = readScopedPincode(pinUserId);

      if (savedPincode && savedPincode.length === 6) {
        setPincode(savedPincode);
        setIsPincodeAvailable(null);
        setShowDeliveryInfo(false);
      } else {
        setPincode('');
        setIsPincodeAvailable(null);
        setShowDeliveryInfo(false);
      }
    }
  }, [isOpen, pinUserId]);

  // Auto-evaluate availability once we have both pincode + config
  useEffect(() => {
    if (!isOpen) return;
    if (pincode.length !== 6) return;
    const ok = isDeliverable(pincode);
    setIsPincodeAvailable(ok);
    setShowDeliveryInfo(ok);
  }, [isOpen, pincode, serviceablePincodes]);

  // Listen for storage events (for cross-tab sync only)
  useEffect(() => {
    if (!isOpen) return;

    const handleStorageChange = (e: StorageEvent) => {
      const pk = scopedPincodeKey(pinUserId);
      if (e.key === pk || e.key === 'milko_delivery_pincode') {
        setPincode((e.newValue || readScopedPincode(pinUserId) || '').trim());
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isOpen, pinUserId]);

  // Save pincode to localStorage when changed
  const handlePincodeChange = (val: string) => {
    // Update state first
    setPincode(val);
    setShowDeliveryInfo(false);
    // Reset availability when pincode changes
    setIsPincodeAvailable(null);
    // Save to localStorage (use setTimeout to avoid blocking input)
    setTimeout(() => {
      const pk = scopedPincodeKey(pinUserId);
      const sk = scopedPincodeStatusKey(pinUserId);
      if (val.length > 0) {
        localStorage.setItem(pk, val);
      } else {
        localStorage.removeItem(pk);
        localStorage.removeItem(sk);
      }
    }, 0);
  };

  // Check pincode availability
  const handleCheckPincode = async () => {
    if (pincode.length !== 6) return;

    setIsCheckingPincode(true);
    setShowDeliveryInfo(false);
    setIsPincodeAvailable(null);

    setTimeout(() => {
      const isAvailable = isDeliverable(pincode);
      setIsPincodeAvailable(isAvailable);
      setShowDeliveryInfo(isAvailable);
      setIsCheckingPincode(false);
      if (pincode.length === 6) {
        writeScopedPincode(pinUserId, pincode, isAvailable ? 'available' : 'unavailable');
      }
    }, 800); // Simulate network delay
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Save current scroll position
      const scrollY = window.scrollY;
      // Disable body scroll
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      document.body.style.overflow = 'hidden';
      
      // Cleanup function to restore scroll when modal closes
      return () => {
        const scrollY = document.body.style.top;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        // Restore scroll position
        if (scrollY) {
          const savedScrollY = Math.abs(parseInt(scrollY.replace('px', '') || '0', 10));
          // Use requestAnimationFrame to ensure DOM is ready
          requestAnimationFrame(() => {
            window.scrollTo(0, savedScrollY);
          });
        }
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedVariationId(null);
      setIsZoomOpen(false);
      setZoomScale(1);
      setZoomOrigin(null);
      setZoomAnimToCenter(false);
      pinchRef.current = null;
      // Fetch product details with images, variations, and reviews
      const fetchDetails = async () => {
        setLoadingDetails(true);
        try {
          const details = await productsApi.getById(product.id, true);
          setProductDetails(details);
          if (getOrderedProductImageUrls(details).length > 0) {
            setSelectedImageIndex(0);
          }
        } catch (error) {
          console.error('Failed to fetch product details:', error);
          // Fallback to basic product data
          setProductDetails(product);
        } finally {
          setLoadingDetails(false);
        }
      };

      fetchDetails();
    }
  }, [isOpen, product.id]);

  // Use product details if available, otherwise fallback to basic product
  const displayProduct = productDetails || product;

  const effectiveCategoryId = displayProduct.categoryId ?? null;

  // Related products should be same category only (or none)
  useEffect(() => {
    if (!isOpen) return;
    if (!effectiveCategoryId) {
      setRelatedProducts([]);
      setLoadingRelated(false);
      return;
    }

    const fetchRelated = async () => {
      setLoadingRelated(true);
      try {
        const all = await productsApi.getAll();
        const related = all
          .filter((p) => p.id !== product.id)
          .filter((p) => (p.categoryId ?? null) === effectiveCategoryId)
          .slice(0, 4);
        setRelatedProducts(related);
      } catch (error) {
        console.error('Failed to fetch related products:', error);
        setRelatedProducts([]);
      } finally {
        setLoadingRelated(false);
      }
    };

    fetchRelated();
  }, [isOpen, product.id, effectiveCategoryId]);
  
  const productImages = getOrderedProductImageUrls(displayProduct);

  const collageItems = productImages;
  collageLenRef.current = collageItems.length;

  const minSwipeDistance = 40;

  const isFromMainImageNavButton = (target: EventTarget | null) =>
    target instanceof Element && Boolean(target.closest('button'));

  /* Capture phase + layout timing so touches on the inner <img> still hit our logic; touch-action:none on CSS stops the browser taking horizontal pans. */
  useLayoutEffect(() => {
    const el = mainImageRef.current;
    if (!el || !isOpen || loadingDetails) return;

    let startX = 0;
    let startY = 0;
    let endX = 0;
    let tracking = false;

    const onStart = (ev: TouchEvent) => {
      if (ev.touches.length !== 1) return;
      if (isFromMainImageNavButton(ev.target)) return;
      tracking = true;
      startX = ev.touches[0].clientX;
      startY = ev.touches[0].clientY;
      endX = startX;
      didSwipeRef.current = false;
    };

    const onMove = (ev: TouchEvent) => {
      if (!tracking || ev.touches.length !== 1) return;
      const t = ev.touches[0];
      endX = t.clientX;
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
      if (dx > dy && dx > 10) {
        didSwipeRef.current = true;
        ev.preventDefault();
      }
    };

    const onEnd = (ev: TouchEvent) => {
      if (!tracking) return;
      const cx = ev.changedTouches[0]?.clientX;
      if (cx !== undefined) endX = cx;
      tracking = false;

      const len = collageLenRef.current;
      if (len <= 1) return;
      const distance = startX - endX;
      if (distance > minSwipeDistance) {
        setSelectedImageIndex((i) => (i + 1) % len);
      } else if (distance < -minSwipeDistance) {
        setSelectedImageIndex((i) => (i - 1 + len) % len);
      }
    };

    const onCancel = () => {
      tracking = false;
    };

    const cap = { capture: true } as const;
    el.addEventListener('touchstart', onStart, { ...cap, passive: true });
    el.addEventListener('touchmove', onMove, { ...cap, passive: false });
    el.addEventListener('touchend', onEnd, { ...cap, passive: true });
    el.addEventListener('touchcancel', onCancel, { ...cap, passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart, cap);
      el.removeEventListener('touchmove', onMove, cap);
      el.removeEventListener('touchend', onEnd, cap);
      el.removeEventListener('touchcancel', onCancel, cap);
    };
  }, [isOpen, loadingDetails, collageItems.length]);

  const openImageZoom = useCallback(() => {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 400;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 700;
    const finalW = Math.min(980, vw - 32);
    const finalH = Math.min(720, vh - 32);
    const el = mainImageRef.current;
    if (el) {
      const thumb = el.getBoundingClientRect();
      const tcx = thumb.left + thumb.width / 2;
      const tcy = thumb.top + thumb.height / 2;
      let s0 = Math.min(thumb.width / finalW, thumb.height / finalH, 1);
      if (s0 < 0.12) s0 = 0.12;
      s0 *= 0.96;
      setZoomOrigin({ tcx, tcy, s0, finalW, finalH, vw, vh });
    } else {
      setZoomOrigin({ tcx: vw / 2, tcy: vh / 2, s0: 0.88, finalW, finalH, vw, vh });
    }
    setZoomAnimToCenter(false);
    setZoomScale(1);
    setIsZoomOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setZoomAnimToCenter(true));
    });
  }, []);

  const closeImageZoom = useCallback(() => {
    setIsZoomOpen(false);
    setZoomAnimToCenter(false);
    setZoomOrigin(null);
    setZoomScale(1);
    pinchRef.current = null;
  }, []);

  const touchPinchDist = (a: React.Touch, b: React.Touch) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const onZoomPinchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinchRef.current = {
        distance: touchPinchDist(e.touches[0], e.touches[1]),
        scale: zoomScaleRef.current,
      };
    }
  };

  const onZoomPinchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    const d = touchPinchDist(e.touches[0], e.touches[1]);
    if (d < 1) return;
    const next = pinchRef.current.scale * (d / pinchRef.current.distance);
    setZoomScale(Math.min(4, Math.max(1, Number(next.toFixed(3)))));
  };

  const onZoomPinchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (isFromMainImageNavButton(e.target)) return;
    setIsDragging(true);
    setMouseStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || mouseStart === null) return;
    // Prevent text selection while dragging
    e.preventDefault();
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (isFromMainImageNavButton(e.target)) {
      if (isDragging) {
        setIsDragging(false);
        setMouseStart(null);
      }
      return;
    }
    if (!isDragging || mouseStart === null) return;

    const distance = mouseStart - e.clientX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    const len = collageLenRef.current;
    if (isLeftSwipe && len > 1) {
      didSwipeRef.current = true;
      setSelectedImageIndex((i) => (i + 1) % len);
    }
    if (isRightSwipe && len > 1) {
      didSwipeRef.current = true;
      setSelectedImageIndex((i) => (i - 1 + len) % len);
    }

    setIsDragging(false);
    setMouseStart(null);
  };

  const onMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false);
      setMouseStart(null);
    }
  };

  // Get variations from product details (only show if they exist)
  const variations = (displayProduct.variations && displayProduct.variations.length > 0) 
    ? displayProduct.variations 
    : [];
  const availableVariations = variations.filter((v) => v.isAvailable);

  useEffect(() => {
    if (!isOpen) return;
    if (availableVariations.length === 0) {
      setSelectedVariationId(null);
      return;
    }
    // If nothing selected (or selection no longer valid), default to first available.
    if (availableVariations.length > 0) {
      if (!selectedVariationId || !availableVariations.some((v) => v.id === selectedVariationId)) {
        setSelectedVariationId(availableVariations[0].id);
      }
    } else {
      setSelectedVariationId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, displayProduct.id, availableVariations.map((v) => v.id).join(',')]);

  const selectedVariation =
    availableVariations.find((v) => v.id === selectedVariationId) || availableVariations[0] || null;

  // Reviews should only show real, approved customer reviews
  const reviews = (displayProduct.reviews || []).filter((r: ProductReview) => r.isApproved);

  // Get feedback aggregates (from order feedback)
  const feedback = displayProduct.feedbackAggregates;
  
  // Calculate average rating from "Quality of the product" only (for circular badge)
  const qualityRating = feedback?.qualityStars ?? null;
  
  // Calculate average rating from reviews (fallback for product header display)
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : (qualityRating ?? 0);
  
  // Helper function to render stars (similar to HowWasItModal, but non-interactive)
  const renderStars = (rating: number | null) => {
    const avgRating = rating ?? 0;
    const fullStars = Math.floor(avgRating);
    const hasHalfStar = avgRating % 1 >= 0.5 && avgRating > 0 && fullStars < 5;
    const roundedRating = Math.round(avgRating);
    
    return (
      <div 
        className={howWasItStyles.stars} 
        data-level={avgRating >= 1 && avgRating <= 5 ? roundedRating : undefined}
        style={{ pointerEvents: 'none' }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const isFull = n <= fullStars;
          const isHalf = n === fullStars + 1 && hasHalfStar;
          const isActive = isFull || isHalf;
          const starClass = `${howWasItStyles.star}${isActive ? ` ${howWasItStyles.starActive}` : ''}`;
          
          if (isHalf) {
            // Render half star - show left half filled
            return (
              <span
                key={n}
                className={starClass}
                style={{
                  cursor: 'default',
                  position: 'relative',
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: '50%',
                    overflow: 'hidden',
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    height: '100%',
                  }}
                >
                  <svg className={howWasItStyles.starIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
                  </svg>
                </span>
                <svg className={howWasItStyles.starIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ opacity: 0.3 }}>
                  <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
                </svg>
              </span>
            );
          }
          
          return (
            <span
              key={n}
              className={starClass}
              style={{
                cursor: 'default',
                opacity: isFull ? 1 : 0.3,
              }}
            >
              <svg className={howWasItStyles.starIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
              </svg>
            </span>
          );
        })}
      </div>
    );
  };

  const safeQty = Math.max(1, Math.min(99, quantity));
  const descriptionHtml = toSafeHtml(displayProduct.description || '');

  const unitMultiplier = selectedVariation?.priceMultiplier ?? 1;
  const unitLabel = selectedVariation?.size ?? (displayProduct.suffixAfterPrice || 'litre');
  const baseSelling = (displayProduct.sellingPrice !== null && displayProduct.sellingPrice !== undefined)
    ? displayProduct.sellingPrice
    : displayProduct.pricePerLitre;
  const baseCompare = (displayProduct.compareAtPrice !== null && displayProduct.compareAtPrice !== undefined)
    ? displayProduct.compareAtPrice
    : null;

  const unitPrice = selectedVariation?.price ?? (baseSelling * unitMultiplier);
  const variationCompare =
    selectedVariation &&
    selectedVariation.compareAtPrice !== null &&
    selectedVariation.compareAtPrice !== undefined &&
    Number.isFinite(Number(selectedVariation.compareAtPrice))
      ? Number(selectedVariation.compareAtPrice)
      : null;
  const originalUnitPrice =
    variationCompare !== null
      ? variationCompare
      : baseCompare !== null
        ? baseCompare * unitMultiplier
        : null;
  const unitOff = originalUnitPrice !== null ? (originalUnitPrice - unitPrice) : 0;

  if (!isOpen) return null;

  const zMotion = zoomOrigin;
  const zoomContentMotionStyle: CSSProperties =
    isZoomOpen && zMotion
      ? !zoomAnimToCenter
        ? {
            position: 'fixed',
            left: '50%',
            top: '50%',
            width: zMotion.finalW,
            height: zMotion.finalH,
            transform: `translate(calc(-50% + ${zMotion.tcx - zMotion.vw / 2}px), calc(-50% + ${zMotion.tcy - zMotion.vh / 2}px)) scale(${zMotion.s0})`,
            transition: 'none',
            willChange: 'transform',
          }
        : {
            position: 'fixed',
            left: '50%',
            top: '50%',
            width: zMotion.finalW,
            height: zMotion.finalH,
            transform: 'translate(-50%, -50%) scale(1)',
            transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'transform',
          }
      : {};

  const zoomOverlayMotionStyle: CSSProperties =
    isZoomOpen && zMotion
      ? {
          opacity: zoomAnimToCenter ? 1 : 0.32,
          transition: 'opacity 340ms ease',
        }
      : {};

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {loadingDetails ? (
          <div className={styles.shimmerWrapper}>
            <div className={styles.shimmerImage}></div>
            <div className={styles.shimmerDetails}>
              <div className={styles.shimmerTitle}></div>
              <div className={styles.shimmerRating}></div>
              <div className={styles.shimmerPrice}></div>
              <div className={styles.shimmerButtons}>
                <div className={styles.shimmerButton}></div>
                <div className={styles.shimmerButton}></div>
              </div>
              <div className={styles.shimmerText}></div>
              <div className={styles.shimmerText}></div>
            </div>
          </div>
        ) : (
          <div className={styles.modalBody}>
          {/* Left Side - Images */}
          <div className={styles.imageSection}>
            {/* Main image with navigation (no collage rail) */}
            <div 
              ref={mainImageRef}
              className={styles.mainImage}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              onClick={(e) => {
                if (isFromMainImageNavButton(e.target)) return;
                if (isDragging) return;
                if (didSwipeRef.current) {
                  didSwipeRef.current = false;
                  return;
                }
                const current = collageItems[selectedImageIndex];
                if (!current || current.startsWith('emoji:')) return;
                openImageZoom();
              }}
              style={{ cursor: isDragging ? 'grabbing' : 'zoom-in', userSelect: 'none' }}
            >
              {collageItems[selectedImageIndex]?.startsWith('emoji:') ? (
                <div className={styles.emojiMain} aria-hidden="true">
                  {collageItems[selectedImageIndex].replace('emoji:', '')}
                </div>
              ) : collageItems[selectedImageIndex] ? (
                <Image
                  src={collageItems[selectedImageIndex]}
                  alt={product.name}
                  width={1200}
                  height={1200}
                  className={styles.mainModalPhoto}
                  sizes="(max-width: 968px) 100vw, min(560px, 50vw)"
                />
              ) : (
                <div className={styles.placeholderImage}>
                  <span>🥛</span>
                </div>
              )}

              {collageItems.length > 1 && (
                <>
                  <button
                    type="button"
                    className={`${styles.imageNavButton} ${styles.imageNavLeft}`}
                    onClick={() =>
                      setSelectedImageIndex((i) => (i - 1 + collageItems.length) % collageItems.length)
                    }
                    aria-label="Previous image"
                  >
                    <svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" style={{ transform: 'scaleX(-1)' }}>
                      <path d="M8.489 31.975c-0.271 0-0.549-0.107-0.757-0.316-0.417-0.417-0.417-1.098 0-1.515l14.258-14.264-14.050-14.050c-0.417-0.417-0.417-1.098 0-1.515s1.098-0.417 1.515 0l14.807 14.807c0.417 0.417 0.417 1.098 0 1.515l-15.015 15.022c-0.208 0.208-0.486 0.316-0.757 0.316z"></path>
                    </svg>
                  </button>
                  <button
                    type="button"
                    className={`${styles.imageNavButton} ${styles.imageNavRight}`}
                    onClick={() => setSelectedImageIndex((i) => (i + 1) % collageItems.length)}
                    aria-label="Next image"
                  >
                    <svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.489 31.975c-0.271 0-0.549-0.107-0.757-0.316-0.417-0.417-0.417-1.098 0-1.515l14.258-14.264-14.050-14.050c-0.417-0.417-0.417-1.098 0-1.515s1.098-0.417 1.515 0l14.807 14.807c0.417 0.417 0.417 1.098 0 1.515l-15.015 15.022c-0.208 0.208-0.486 0.316-0.757 0.316z"></path>
                    </svg>
                  </button>
                </>
              )}
            </div>

            {collageItems.length > 1 && (
              <div className={styles.imageDots} aria-label="Image navigation">
                {collageItems.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`${styles.imageDot} ${idx === selectedImageIndex ? styles.imageDotActive : ''}`}
                    onClick={() => setSelectedImageIndex(idx)}
                    aria-label={`Go to image ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Side - Details */}
          <div className={styles.detailsSection}>
            {/* Product Title & Rating */}
            <div className={styles.productHeader}>
              <h1 className={styles.productTitle}>{displayProduct.name}</h1>
              {reviews.length > 0 && (
                <div className={styles.productRating}>
                  <RatingBadge rating={averageRating} size="md" />
                  <span className={styles.reviewCount}>({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
                </div>
              )}
            </div>

            {/* Price Section */}
            <div className={styles.priceSection}>
              <div className={styles.priceContainer}>
                {originalUnitPrice !== null && unitOff > 0 && (
                  <div className={styles.originalPrice}>
                    ₹{originalUnitPrice.toFixed(0)} <span className={styles.priceUnit}>/{unitLabel}</span>
                  </div>
                )}
                <div className={styles.currentPrice}>
                  ₹{unitPrice.toFixed(0)} <span className={styles.priceUnit}>/{unitLabel}</span>
                </div>
              </div>
              {originalUnitPrice !== null && unitOff > 0 && (
                <div className={styles.discountBadge}>
                  ₹{unitOff.toFixed(0)} OFF
                </div>
              )}
            </div>

            {/* Stock Status */}
            {(() => {
              const hasVariations = variations && variations.length > 0;
              const isInStock = hasVariations 
                ? variations.some(v => v.isAvailable)
                : displayProduct.isActive;
              
              // Check if product is low in stock
              const quantity = displayProduct.quantity ?? 0;
              const lowStockThreshold = displayProduct.lowStockThreshold ?? 10;
              const isLowStock = quantity > 0 && quantity < lowStockThreshold;
              
              return (
                <div className={`${styles.stockStatus} ${isInStock ? (isLowStock ? styles.lowStock : styles.inStock) : styles.outOfStock}`}>
                  {isInStock ? (
                    <>
                      {isLowStock ? (
                        <>
                          <svg className={styles.stockIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                            <path d="M12 7V13M12 16V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                          <span>Low in stock</span>
                        </>
                      ) : (
                        <>
                          <svg className={styles.stockIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                            <path d="M8 12L11 15L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                          <span>In Stock</span>
                        </>
                      )}
                    </>
                  ) : (
                    <>
                      <svg className={styles.stockIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                        <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      <span>Out of Stock</span>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Qty + Actions (before description) */}
            <div className={styles.purchaseSection}>
              <div className={styles.qtyRow}>
                <div className={styles.qtyLabel}>Qty</div>
                <div className={styles.qtyControl} aria-label="Quantity selector">
                  <button
                    type="button"
                    className={styles.qtyButton}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M6 12L18 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </button>
                  <input
                    className={styles.qtyInput}
                    value={safeQty}
                    inputMode="numeric"
                    onChange={(e) => {
                      const n = parseInt(e.target.value || '1', 10);
                      setQuantity(Number.isFinite(n) ? n : 1);
                    }}
                    aria-label="Quantity"
                  />
                  <button
                    type="button"
                    className={styles.qtyButton}
                    onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                    aria-label="Increase quantity"
                  >
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 12H20M12 4V20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Variations (managed by admin) */}
              {variations.length > 0 && (
                <div className={styles.variationPicker}>
                  <div className={styles.variationRow}>
                    <div className={styles.variationLabel}>Size</div>
                    <div className={styles.variationsGrid}>
                    {variations.map((variation) => {
                      const price = displayProduct.pricePerLitre * variation.priceMultiplier;
                      const isActive = variation.id === selectedVariation?.id;
                      return (
                        <button
                          key={variation.id}
                          type="button"
                          className={`${styles.variationButton} ${isActive ? styles.variationActive : ''} ${variation.isAvailable ? '' : styles.variationDisabled}`}
                          disabled={!variation.isAvailable}
                          onClick={() => setSelectedVariationId(variation.id)}
                          title={!variation.isAvailable ? 'Not available' : `${variation.size} - ₹${price.toFixed(2)}`}
                        >
                          {variation.size}
                        </button>
                      );
                    })}
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery Pincode Section */}
              <div className={styles.deliverySection}>
                <div className={styles.deliveryLabel}>Delivery</div>
                <div className={styles.pincodeInputWrapper}>
                  <input
                    type="text"
                    className={styles.pincodeInput}
                    placeholder="Enter pincode"
                    value={pincode}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                      handlePincodeChange(val);
                    }}
                    maxLength={6}
                    inputMode="numeric"
                    aria-label="Delivery pincode"
                  />
                  <button
                    type="button"
                    className={styles.pincodeCheckButton}
                    onClick={handleCheckPincode}
                    disabled={pincode.length !== 6 || isCheckingPincode}
                    aria-label="Check delivery"
                  >
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.489 31.975c-0.271 0-0.549-0.107-0.757-0.316-0.417-0.417-0.417-1.098 0-1.515l14.258-14.264-14.050-14.050c-0.417-0.417-0.417-1.098 0-1.515s1.098-0.417 1.515 0l14.807 14.807c0.417 0.417 0.417 1.098 0 1.515l-15.015 15.022c-0.208 0.208-0.486 0.316-0.757 0.316z" fill="currentColor"></path>
                    </svg>
                  </button>
                </div>
                {isCheckingPincode && (
                  <div className={styles.deliveryInfo} style={{ color: '#666' }}>
                    Checking availability...
                  </div>
                )}
                {!isCheckingPincode && isPincodeAvailable === true && (
                  <div className={styles.deliveryInfo} style={{ color: '#10b981' }}>
                    ✓ Will be delivered by today
                  </div>
                )}
                {!isCheckingPincode && isPincodeAvailable === false && (
                  <div className={styles.deliveryInfo} style={{ color: '#dc3545' }}>
                    ✗ Delivery not available for this pincode
                  </div>
                )}
              </div>

              {/* Your Amount Section */}
              <div className={styles.amountSection}>
                <div className={styles.amountLabel}>Your amount</div>
                <div className={styles.amountRow}>
                  <span className={styles.amountValue}>₹{(unitPrice * safeQty).toFixed(2)}</span>
                  {safeQty > 0 && (
                    <span className={styles.amountSavings}>
                      {originalUnitPrice !== null && unitOff > 0
                        ? `You will save ₹${(unitOff * safeQty).toFixed(2)}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>

              <div className={styles.actionButtons}>
                <button
                  ref={addToCartButtonRef}
                  type="button"
                  className={styles.addToCartButton}
                  disabled={pincode.length !== 6 || isPincodeAvailable !== true}
                  onClick={() => {
                    // Add to cart
                    addItem({
                      productId: displayProduct.id,
                      variationId: selectedVariation?.id ?? undefined,
                      quantity: safeQty,
                    });

                    // Show notification
                    showToast('Added to cart', 'success');

                    // Get product image URL for animation
                    const imageUrl = productImages.length > 0 && !productImages[0].startsWith('emoji:')
                      ? productImages[0]
                      : displayProduct.imageUrl || '';

                    // Get source and target elements for animation
                    const sourceElement = addToCartButtonRef.current;
                    const targetElement = cartIconRefStore.getAny();

                    // Animate if we have both elements and an image
                    if (sourceElement && targetElement && imageUrl) {
                      animateToCart({
                        imageUrl,
                        sourceElement,
                        targetElement,
                      });
                    }
                  }}
                >
                  Add to Cart
                </button>
                <button
                  type="button"
                  className={styles.buyNowButton}
                  onClick={() => {
                    if (pincode.length !== 6 || isPincodeAvailable !== true) return;
                    addItem({
                      productId: displayProduct.id,
                      quantity: Math.max(1, quantity),
                      variationId: selectedVariationId ?? undefined,
                    });
                    onClose();
                    window.location.href = '/cart';
                  }}
                  style={{
                    opacity: (pincode.length === 6 && isPincodeAvailable === true) ? 1 : 0.5,
                    cursor: (pincode.length === 6 && isPincodeAvailable === true) ? 'pointer' : 'not-allowed',
                    pointerEvents: (pincode.length === 6 && isPincodeAvailable === true) ? 'auto' : 'none',
                  }}
                >
                  <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      <path id="primary" d="M18,11.74a1,1,0,0,0-.52-.63L14.09,9.43,15,3.14a1,1,0,0,0-1.78-.75l-7,9a1,1,0,0,0-.18.87,1.05,1.05,0,0,0,.6.67l4.27,1.71L10,20.86a1,1,0,0,0,.63,1.07A.92.92,0,0,0,11,22a1,1,0,0,0,.83-.45l6-9A1,1,0,0,0,18,11.74Z"></path>
                    </g>
                  </svg>
                  Buy Now
                </button>
              </div>
            </div>

            {/* Membership Subscription Section - Only show if product is membership eligible */}
            {displayProduct.isMembershipEligible && (
              <div className={styles.membershipSection}>
                <div className={styles.membershipHeader}>
                  <div>
                    <div className={styles.membershipTitleRow}>
                      <h3 className={styles.membershipTitle}>Take a membership of this</h3>
                      <svg
                        className={styles.membershipTitleIcon}
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M7.45284 2.71266C7.8276 1.76244 9.1724 1.76245 9.54716 2.71267L10.7085 5.65732C10.8229 5.94743 11.0526 6.17707 11.3427 6.29148L14.2873 7.45284C15.2376 7.8276 15.2376 9.1724 14.2873 9.54716L11.3427 10.7085C11.0526 10.8229 10.8229 11.0526 10.7085 11.3427L9.54716 14.2873C9.1724 15.2376 7.8276 15.2376 7.45284 14.2873L6.29148 11.3427C6.17707 11.0526 5.94743 10.8229 5.65732 10.7085L2.71266 9.54716C1.76244 9.1724 1.76245 7.8276 2.71267 7.45284L5.65732 6.29148C5.94743 6.17707 6.17707 5.94743 6.29148 5.65732L7.45284 2.71266Z"
                          fill="#008037"
                        />
                        <path
                          d="M16.9245 13.3916C17.1305 12.8695 17.8695 12.8695 18.0755 13.3916L18.9761 15.6753C19.039 15.8348 19.1652 15.961 19.3247 16.0239L21.6084 16.9245C22.1305 17.1305 22.1305 17.8695 21.6084 18.0755L19.3247 18.9761C19.1652 19.039 19.039 19.1652 18.9761 19.3247L18.0755 21.6084C17.8695 22.1305 17.1305 22.1305 16.9245 21.6084L16.0239 19.3247C15.961 19.1652 15.8348 19.039 15.6753 18.9761L13.3916 18.0755C12.8695 17.8695 12.8695 17.1305 13.3916 16.9245L15.6753 16.0239C15.8348 15.961 15.961 15.8348 16.0239 15.6753L16.9245 13.3916Z"
                          fill="#008037"
                        />
                      </svg>
                    </div>
                    <p className={styles.membershipDescription}>
                      Get {displayProduct.name} - Fresh, carefully handled with zero adulteration. Quality-checked before every delivery, with assured supply for members.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.membershipMoreButton}
                    onClick={() => setShowMembershipDetails(!showMembershipDetails)}
                  >
                    {showMembershipDetails ? 'Less' : 'More'}
                    <svg 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                      className={styles.membershipChevron}
                      style={{ transform: showMembershipDetails ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>

                {showMembershipDetails && (
                  <div className={styles.membershipForm}>
                    {/* Frequency Selection */}
                    <div className={styles.membershipField}>
                      <label className={styles.membershipLabel}>Frequency</label>
                      <select
                        value={membershipFrequency}
                        onChange={(e) => setMembershipFrequency(e.target.value as 'daily' | 'weekly' | 'monthly' | 'quarterly')}
                        className={styles.membershipSelect}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                      </select>
                    </div>

                    {/* Quantity Selection */}
                    <div className={styles.membershipField}>
                      <label className={styles.membershipLabel}>Quantity</label>
                      <select
                        value={membershipQuantity}
                        onChange={(e) => setMembershipQuantity(e.target.value)}
                        className={styles.membershipSelect}
                      >
                        <option value="0.5">0.5 Liters</option>
                        <option value="1">1 Liter</option>
                        <option value="2">2 Liters</option>
                        <option value="3">3 Liters</option>
                        <option value="4">4 Liters</option>
                        <option value="5">5 Liters</option>
                      </select>
                    </div>

                    {/* Duration Selection */}
                    <div className={styles.membershipField}>
                      <label className={styles.membershipLabel}>Duration</label>
                      <select
                        value={membershipDuration}
                        onChange={(e) => setMembershipDuration(e.target.value)}
                        className={styles.membershipSelect}
                      >
                        <option value="7">7 Days (1 Week)</option>
                        <option value="15">15 Days</option>
                        <option value="30">30 Days (1 Month)</option>
                        <option value="60">60 Days (2 Months)</option>
                        <option value="90">90 Days (3 Months)</option>
                        <option value="180">180 Days (6 Months)</option>
                        <option value="365">365 Days (1 Year)</option>
                      </select>
                    </div>

                    {/* Total Amount Display */}
                    {(() => {
                      const basePrice = (displayProduct.sellingPrice !== null && displayProduct.sellingPrice !== undefined)
                        ? displayProduct.sellingPrice
                        : displayProduct.pricePerLitre;
                      
                      // Calculate number of deliveries based on frequency
                      const durationDays = parseFloat(membershipDuration);
                      let numberOfDeliveries = 0;
                      
                      if (membershipFrequency === 'daily') {
                        numberOfDeliveries = durationDays; // 1 delivery per day
                      } else if (membershipFrequency === 'weekly') {
                        numberOfDeliveries = Math.ceil(durationDays / 7); // 1 delivery per week
                      } else if (membershipFrequency === 'monthly') {
                        numberOfDeliveries = Math.ceil(durationDays / 30); // 1 delivery per month
                      } else if (membershipFrequency === 'quarterly') {
                        numberOfDeliveries = Math.ceil(durationDays / 90); // 1 delivery per quarter
                      }
                      
                      const quantityPerDelivery = parseFloat(membershipQuantity);
                      const totalAmount = basePrice * quantityPerDelivery * numberOfDeliveries;
                      
                      return (
                        <div className={styles.membershipTotal}>
                          <div className={styles.membershipTotalLabel}>Total Amount</div>
                          <div className={styles.membershipTotalValue}>₹{totalAmount.toFixed(2)}</div>
                        </div>
                      );
                    })()}

                    {/* Subscribe Now Button */}
                    <Link
                      href={pincode.length === 6 && isPincodeAvailable === true
                        ? `/subscribe?productId=${displayProduct.id}&liters=${membershipQuantity}&days=${membershipDuration}&months=${Math.ceil(parseInt(membershipDuration) / 30)}&frequency=${membershipFrequency}`
                        : '#'}
                      className={styles.membershipSubscribeButton}
                      onClick={(e) => {
                        if (pincode.length !== 6) {
                          e.preventDefault();
                          window.dispatchEvent(new CustomEvent('milko:open-pincode-modal'));
                          return;
                        }
                        if (isPincodeAvailable !== true) {
                          e.preventDefault();
                          return;
                        }
                        onClose();
                      }}
                      style={{
                        opacity: (pincode.length === 6 && isPincodeAvailable === true) ? 1 : 0.5,
                        cursor: (pincode.length === 6 && isPincodeAvailable === true) ? 'pointer' : 'not-allowed',
                        pointerEvents: 'auto',
                      }}
                    >
                      Subscribe Now
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div className={styles.descriptionSection}>
              <h3 className={styles.sectionTitle}>Description</h3>
              <div
                className={styles.descriptionText}
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            </div>

            {/* Review Summary Section - New Layout */}
            <div className={styles.reviewSummarySection}>
              <h3 className={styles.sectionTitle}>Customer Reviews</h3>
              {/* Top: 50-50 Split Section */}
              <div className={styles.reviewSummaryContent}>
                {/* Left: Rating Number with Star and Count */}
                <div className={styles.reviewSummaryLeft}>
                  <div className={styles.ratingCardNumberRow}>
                    {(() => {
                      const rating = qualityRating ?? 0;
                      // Color based on rating: dull gray for 0, dark green for 4-5, orange for 3, red for 1-2
                      let ratingColor = '#dc2626'; // red for low ratings
                      if (rating === 0) {
                        ratingColor = '#9ca3af'; // dull light gray for no ratings
                      } else if (rating >= 4) {
                        ratingColor = '#14532d'; // dark green for high ratings
                      } else if (rating >= 3) {
                        ratingColor = '#ea580c'; // orange for medium ratings
                      }
                      
                      return (
                        <>
                          <span 
                            className={styles.ratingCardNumber}
                            style={{ color: ratingColor }}
                          >
                            {rating.toFixed(1)}
                          </span>
                          <svg 
                            className={styles.ratingCardStar} 
                            viewBox="0 0 24 24" 
                            fill="currentColor" 
                            aria-hidden="true"
                            style={{ color: ratingColor }}
                          >
                            <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
                          </svg>
                        </>
                      );
                    })()}
                  </div>
                  <div className={styles.ratingCardCount}>
                    Based on {feedback?.qualityCount ?? 0} review{feedback?.qualityCount !== 1 ? 's' : ''}
                  </div>
                  <button 
                    className={styles.showMoreButton}
                    onClick={() => setShowRatingDetailsPopup(true)}
                  >
                    Show more
                  </button>
                </div>

                {/* Right: Rating Distribution Progress Bars */}
                <div className={styles.reviewSummaryRightTop}>
                  <div className={styles.ratingDistribution}>
                    {[5, 4, 3, 2, 1].map((starLevel) => {
                      const count = feedback?.ratingDistribution?.[starLevel as keyof typeof feedback.ratingDistribution] ?? 0;
                      const total = feedback?.qualityCount || 1;
                      const percentage = total > 0 ? (count / total) * 100 : 0;
                      
                      // Color based on rating: green for 5-4, orange for 3-2, red for 1
                      let barColor = '#10b981'; // green
                      if (starLevel === 3 || starLevel === 2) {
                        barColor = '#ea580c'; // orange
                      } else if (starLevel === 1) {
                        barColor = '#dc2626'; // red
                      }
                      
                      return (
                        <div key={starLevel} className={styles.ratingBarRow}>
                          <div className={styles.ratingBarLabel}>
                            <span>{starLevel}</span>
                            <svg className={styles.ratingBarStarIcon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                              <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
                            </svg>
                          </div>
                          <div className={styles.ratingBarContainer}>
                            <div 
                              className={styles.ratingBar}
                              style={{ 
                                width: `${percentage}%`,
                                background: barColor
                              }}
                            ></div>
                          </div>
                          <div className={styles.ratingBarCount}>{count}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rating Details Popup */}
              {showRatingDetailsPopup && (
                <div className={styles.ratingDetailsPopupOverlay} onClick={() => setShowRatingDetailsPopup(false)}>
                  <div className={styles.ratingDetailsPopup} onClick={(e) => e.stopPropagation()}>
                    <button 
                      className={styles.ratingDetailsPopupClose}
                      onClick={() => setShowRatingDetailsPopup(false)}
                      aria-label="Close"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <h3 className={styles.ratingDetailsPopupTitle}>Rating Details</h3>
                    <div className={styles.ratingDetailsContent}>
                      <div className={howWasItStyles.starRow}>
                        <div className={howWasItStyles.subTitle}>Quality of the product</div>
                        {renderStars(feedback?.qualityStars ?? null)}
                      </div>
                      <div className={howWasItStyles.starRow}>
                        <div className={howWasItStyles.subTitle}>Delivery agent behaviour</div>
                        {renderStars(feedback?.deliveryAgentStars ?? null)}
                      </div>
                      <div className={howWasItStyles.starRow}>
                        <div className={howWasItStyles.subTitle}>On time delivery</div>
                        {renderStars(feedback?.onTimeStars ?? null)}
                      </div>
                      <div className={howWasItStyles.starRow}>
                        <div className={howWasItStyles.subTitle}>Value for money</div>
                        {renderStars(feedback?.valueForMoneyStars ?? null)}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Related Products / Other Offerings */}
            {loadingRelated ? (
              <div className={styles.relatedSection}>
                <h3 className={styles.sectionTitle}>Related Products</h3>
                <div className={styles.relatedProductsGrid}>
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={styles.relatedProductCardShimmer}>
                      <div className={styles.relatedPlaceholderShimmer}></div>
                      <div className={styles.relatedProductNameShimmer}></div>
                      <div className={styles.relatedProductPriceShimmer}></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : relatedProducts.length > 0 ? (
              <div className={styles.relatedSection}>
                <h3 className={styles.sectionTitle}>Related Products</h3>
                <div className={styles.relatedProductsGrid}>
                  {relatedProducts.map((relatedProduct) => (
                    <button
                      key={relatedProduct.id}
                      type="button"
                      className={styles.relatedProductCard}
                      onClick={() => {
                        if (onRelatedProductClick) {
                          onRelatedProductClick(relatedProduct);
                        } else {
                          // Fallback: navigate to subscribe page
                          window.location.href = `/subscribe?productId=${relatedProduct.id}`;
                        }
                      }}
                    >
                      <button
                        type="button"
                        className={styles.relatedAddButton}
                        aria-label={`Add ${relatedProduct.name} to cart`}
                        onClick={(e) => {
                          e.stopPropagation();
                          addItem({ productId: relatedProduct.id, quantity: 1 });
                          showToast('Added to cart', 'success');

                          const pickVisibleCartTarget = (): HTMLElement | null => {
                            const candidates = [
                              cartIconRefStore.getDesktop(),
                              cartIconRefStore.getMobile(),
                            ].filter(Boolean) as HTMLElement[];

                            if (candidates.length === 0) return null;

                            const visible = candidates.find((el) => {
                              const r = el.getBoundingClientRect();
                              return r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
                            });

                            return visible || candidates[0];
                          };

                          const iconEl = pickVisibleCartTarget();
                          if (iconEl) {
                            // Prefer the badge element (where the cart count number is shown)
                            const badge =
                              (iconEl.querySelector('[class*="cartBadge"], .cartBadge') as HTMLElement | null) ||
                              (iconEl.closest('a[href="/cart"]')?.querySelector('[class*="cartBadge"], .cartBadge') as HTMLElement | null);

                            const targetElement = badge || iconEl;

                            animateToCart({
                              sourceElement: e.currentTarget as HTMLElement,
                              targetElement,
                              imageUrl: relatedProduct.imageUrl || '',
                            });
                          }
                        }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M6 12H18M12 6V18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                      </button>
                      {relatedProduct.imageUrl ? (
                        <Image
                          src={relatedProduct.imageUrl}
                          alt={relatedProduct.name}
                          width={100}
                          height={100}
                          style={{ objectFit: 'cover', borderRadius: '8px' }}
                        />
                      ) : (
                        <div className={styles.relatedPlaceholder}>🥛</div>
                      )}
                      <div className={styles.relatedProductName}>{relatedProduct.name}</div>
                      <div className={styles.relatedProductPrice}>₹{relatedProduct.pricePerLitre}/{relatedProduct.suffixAfterPrice || 'Litres'}</div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Action Buttons moved above description */}
          </div>
        </div>
        )}
      </div>

      {/* Zoom overlay — opens from thumbnail position; pinch to zoom on touch */}
      {isZoomOpen && collageItems[selectedImageIndex] && (
        <div
          className={styles.zoomOverlay}
          style={zoomOverlayMotionStyle}
          onClick={(e) => {
            e.stopPropagation();
            closeImageZoom();
          }}
          role="dialog"
          aria-label="Image zoom"
        >
          <div
            className={`${styles.zoomContent} ${zMotion ? styles.zoomContentMotion : ''}`}
            style={zoomContentMotionStyle}
            onClick={(e) => {
              e.stopPropagation();
              closeImageZoom();
            }}
          >
            <div className={styles.zoomTopBar} onClick={(e) => e.stopPropagation()}>
              <div className={styles.zoomControls}>
                <button
                  type="button"
                  className={styles.zoomButton}
                  onClick={() => setZoomScale((s) => Math.max(1, parseFloat((s - 0.25).toFixed(2))))}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  className={styles.zoomButton}
                  onClick={() => setZoomScale(1)}
                  aria-label="Reset zoom"
                >
                  Reset
                </button>
                <button
                  type="button"
                  className={styles.zoomButton}
                  onClick={() => setZoomScale((s) => Math.min(4, parseFloat((s + 0.25).toFixed(2))))}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className={styles.zoomClose}
                onClick={closeImageZoom}
                aria-label="Close zoom"
              >
                ✕
              </button>
            </div>

            <div
              className={styles.zoomImageWrap}
              onTouchStart={onZoomPinchStart}
              onTouchMove={onZoomPinchMove}
              onTouchEnd={onZoomPinchEnd}
              onTouchCancel={onZoomPinchEnd}
            >
              <img
                src={collageItems[selectedImageIndex]}
                alt={displayProduct.name}
                className={styles.zoomImage}
                style={{ transform: `scale(${zoomScale})` }}
                draggable={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

