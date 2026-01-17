'use client';

import { useState, useEffect, useRef } from 'react';
import { Product, ProductVariation, ProductReview } from '@/types';
import { productsApi } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import Image from 'next/image';
import Link from 'next/link';
import styles from './ProductDetailsModal.module.css';
import RatingBadge from '@/components/ui/RatingBadge';
import { toSafeHtml } from '@/lib/utils/sanitizeHtml';

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
  
  // Swipe/drag state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [mouseStart, setMouseStart] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const mainImageRef = useRef<HTMLDivElement>(null);
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  // Load pincode from localStorage when modal opens and check availability
  useEffect(() => {
    if (isOpen) {
      const savedPincode = localStorage.getItem('milko_delivery_pincode');
      const savedStatus = localStorage.getItem('milko_delivery_status') as 'available' | 'unavailable' | null;
      
      if (savedPincode && savedPincode.length === 6) {
        setPincode(savedPincode);
        // If we have a saved status, use it immediately
        if (savedStatus === 'available') {
          setIsPincodeAvailable(true);
          setShowDeliveryInfo(true);
        } else if (savedStatus === 'unavailable') {
          setIsPincodeAvailable(false);
          setShowDeliveryInfo(false);
        } else {
          // If no saved status, automatically check availability
          setIsCheckingPincode(true);
          setTimeout(() => {
            const isAvailable = savedPincode.startsWith('47');
            setIsPincodeAvailable(isAvailable);
            setShowDeliveryInfo(isAvailable);
            setIsCheckingPincode(false);
            // Save the status for future use
            localStorage.setItem('milko_delivery_status', isAvailable ? 'available' : 'unavailable');
          }, 800);
        }
      } else {
        setPincode('');
        setIsPincodeAvailable(null);
        setShowDeliveryInfo(false);
      }
    }
  }, [isOpen]);

  // Listen for storage events (for cross-tab sync only)
  useEffect(() => {
    if (!isOpen) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'milko_delivery_pincode') {
        setPincode(e.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [isOpen]);

  // Save pincode to localStorage when changed
  const handlePincodeChange = (val: string) => {
    // Update state first
    setPincode(val);
    setShowDeliveryInfo(false);
    // Reset availability when pincode changes
    setIsPincodeAvailable(null);
    // Save to localStorage (use setTimeout to avoid blocking input)
    setTimeout(() => {
      if (val.length > 0) {
        localStorage.setItem('milko_delivery_pincode', val);
      } else {
        localStorage.removeItem('milko_delivery_pincode');
      }
    }, 0);
  };

  // Check pincode availability
  const handleCheckPincode = async () => {
    if (pincode.length !== 6) return;

    setIsCheckingPincode(true);
    setShowDeliveryInfo(false);
    setIsPincodeAvailable(null);

    // Simulate API call - Replace with actual API call
    // For now, we'll simulate: pincodes starting with 47 are available (Gwalior area)
    setTimeout(() => {
      const isAvailable = pincode.startsWith('47');
      setIsPincodeAvailable(isAvailable);
      setShowDeliveryInfo(isAvailable);
      setIsCheckingPincode(false);
      // Save the status to localStorage for future use
      localStorage.setItem('milko_delivery_status', isAvailable ? 'available' : 'unavailable');
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
      // Fetch product details with images, variations, and reviews
      const fetchDetails = async () => {
        setLoadingDetails(true);
        try {
          const details = await productsApi.getById(product.id, true);
          setProductDetails(details);
          // Set first image as selected if available
          if (details.images && details.images.length > 0) {
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
  
  // Get images from product details or fallback to single imageUrl
  const productImages = displayProduct.images && displayProduct.images.length > 0
    ? displayProduct.images.map(img => img.imageUrl)
    : (product.imageUrl ? [product.imageUrl] : []);

  const collageItems = productImages;

  // Swipe/drag handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && collageItems.length > 1) {
      setSelectedImageIndex((i) => (i + 1) % collageItems.length);
    }
    if (isRightSwipe && collageItems.length > 1) {
      setSelectedImageIndex((i) => (i - 1 + collageItems.length) % collageItems.length);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setMouseStart(e.clientX);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || mouseStart === null) return;
    // Prevent text selection while dragging
    e.preventDefault();
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!isDragging || mouseStart === null) return;

    const distance = mouseStart - e.clientX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && collageItems.length > 1) {
      setSelectedImageIndex((i) => (i + 1) % collageItems.length);
    }
    if (isRightSwipe && collageItems.length > 1) {
      setSelectedImageIndex((i) => (i - 1 + collageItems.length) % collageItems.length);
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

  // Get variations from product details (or demo variations for testing UI)
  const demoVariations: ProductVariation[] = [
    { id: 'demo-0.5L', productId: displayProduct.id, size: '0.5L', priceMultiplier: 0.5, isAvailable: true, displayOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'demo-1L', productId: displayProduct.id, size: '1L', priceMultiplier: 1, isAvailable: true, displayOrder: 2, createdAt: '', updatedAt: '' },
    { id: 'demo-2L', productId: displayProduct.id, size: '2L', priceMultiplier: 2, isAvailable: true, displayOrder: 3, createdAt: '', updatedAt: '' },
    { id: 'demo-5L', productId: displayProduct.id, size: '5L', priceMultiplier: 4.8, isAvailable: false, displayOrder: 4, createdAt: '', updatedAt: '' },
  ];
  const variations = (displayProduct.variations && displayProduct.variations.length > 0) 
    ? displayProduct.variations 
    : demoVariations;
  const availableVariations = variations.filter((v) => v.isAvailable);

  useEffect(() => {
    if (!isOpen) return;
    if (availableVariations.length === 0) {
      setSelectedVariationId(null);
      return;
    }
    // If nothing selected (or selection no longer valid), default to first available.
    if (!selectedVariationId || !availableVariations.some((v) => v.id === selectedVariationId)) {
      setSelectedVariationId(availableVariations[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, displayProduct.id, availableVariations.map((v) => v.id).join(',')]);

  const selectedVariation =
    availableVariations.find((v) => v.id === selectedVariationId) || availableVariations[0] || null;

  // Reviews should only show real, approved customer reviews
  const reviews = (displayProduct.reviews || []).filter((r: ProductReview) => r.isApproved);

  // Calculate average rating
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 0;

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
  const originalUnitPrice = baseCompare !== null ? (baseCompare * unitMultiplier) : null;
  const unitOff = originalUnitPrice !== null ? (originalUnitPrice - unitPrice) : 0;

  if (!isOpen) return null;

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
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
              onClick={() => {
                if (isDragging) return;
                const current = collageItems[selectedImageIndex];
                if (!current || current.startsWith('emoji:')) return;
                setIsZoomOpen(true);
                setZoomScale(1);
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
                  fill
                  style={{ objectFit: 'cover' }}
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
                <Link
                  href={pincode.length === 6 && isPincodeAvailable === true ? `/subscribe?productId=${displayProduct.id}` : '#'}
                  className={styles.buyNowButton}
                  onClick={(e) => {
                    if (pincode.length !== 6 || isPincodeAvailable !== true) {
                      e.preventDefault();
                      return;
                    }
                    onClose();
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
                </Link>
              </div>
            </div>

            {/* Description */}
            <div className={styles.descriptionSection}>
              <h3 className={styles.sectionTitle}>Description</h3>
              <div
                className={styles.descriptionText}
                dangerouslySetInnerHTML={{ __html: descriptionHtml }}
              />
            </div>

            {/* Reviews Section */}
            {reviews.length > 0 ? (
              <div className={styles.reviewsSection}>
                <h3 className={styles.sectionTitle}>Customer Reviews</h3>
                <div className={styles.reviewsList}>
                  {reviews.map((review) => {
                    const reviewDate = new Date(review.createdAt);
                    const daysAgo = Math.floor((Date.now() - reviewDate.getTime()) / (1000 * 60 * 60 * 24));
                    const dateText = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo} days ago`;
                    
                    return (
                      <div key={review.id} className={styles.reviewItem}>
                        <div className={styles.reviewHeader}>
                          <div className={styles.reviewerInfo}>
                            <div className={styles.reviewerAvatar}>
                              {review.reviewerName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className={styles.reviewerName}>{review.reviewerName}</div>
                              <div className={styles.reviewRating}>
                                <RatingBadge rating={review.rating} size="sm" />
                              </div>
                            </div>
                          </div>
                          <div className={styles.reviewDate}>{dateText}</div>
                        </div>
                        {review.comment && (
                          <p className={styles.reviewText}>{review.comment}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className={styles.reviewsSection}>
                <h3 className={styles.sectionTitle}>Customer Reviews</h3>
                <p className={styles.descriptionText} style={{ color: '#999', fontStyle: 'italic' }}>
                  No reviews yet. Be the first to review this product!
                </p>
              </div>
            )}

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

      {/* Zoom overlay */}
      {isZoomOpen && collageItems[selectedImageIndex] && (
        <div
          className={styles.zoomOverlay}
          onClick={() => setIsZoomOpen(false)}
          role="dialog"
          aria-label="Image zoom"
        >
          <div className={styles.zoomContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.zoomTopBar}>
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
                  onClick={() => setZoomScale((s) => Math.min(3, parseFloat((s + 0.25).toFixed(2))))}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
              <button
                type="button"
                className={styles.zoomClose}
                onClick={() => setIsZoomOpen(false)}
                aria-label="Close zoom"
              >
                ✕
              </button>
            </div>

            <div className={styles.zoomImageWrap}>
              <img
                src={collageItems[selectedImageIndex]}
                alt={displayProduct.name}
                className={styles.zoomImage}
                style={{ transform: `scale(${zoomScale})` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

