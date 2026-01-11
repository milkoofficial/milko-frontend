'use client';

import { useState, useEffect, useRef } from 'react';
import { Product, ProductVariation } from '@/types';
import { productsApi } from '@/lib/api';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import Image from 'next/image';
import Link from 'next/link';
import styles from './ProductDetailsModal.module.css';
import RatingBadge from '@/components/ui/RatingBadge';

interface ProductDetailsModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Product Details Modal Component
 * Shows detailed product information in a beautiful animated popup
 */
export default function ProductDetailsModal({ product, isOpen, onClose }: ProductDetailsModalProps) {
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

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedVariationId(null);
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

      // Fetch related products
      const fetchRelated = async () => {
        setLoadingRelated(true);
        try {
          const products = await productsApi.getAll();
          // Get other products excluding current one
          const related = products.filter(p => p.id !== product.id).slice(0, 4);
          setRelatedProducts(related);
        } catch (error) {
          console.error('Failed to fetch related products:', error);
        } finally {
          setLoadingRelated(false);
        }
      };

      fetchDetails();
      fetchRelated();
    }
  }, [isOpen, product.id]);

  // Use product details if available, otherwise fallback to basic product
  const displayProduct = productDetails || product;
  
  // Get images from product details or fallback to single imageUrl
  const productImages = displayProduct.images && displayProduct.images.length > 0
    ? displayProduct.images.map(img => img.imageUrl)
    : (product.imageUrl ? [product.imageUrl] : []);

  // Demo emoji "images" for products without real images (so you can verify collage layout)
  const demoEmojiImages = ['🥛', '🐮', '🌿', '🚚'].map((e) => `emoji:${e}`);
  const collageItems = productImages.length > 0 ? productImages : demoEmojiImages;

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

  // Get reviews from product details
  const reviews = displayProduct.reviews || [];

  // Calculate average rating
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 5; // Default to 5 if no reviews

  const safeQty = Math.max(1, Math.min(99, quantity));
  const descriptionText =
    displayProduct.description ||
    'Demo description text for layout testing. Freshly sourced every day, quality checked, and delivered chilled to your doorstep.';

  const unitMultiplier = selectedVariation?.priceMultiplier ?? 1;
  const unitLabel = selectedVariation?.size ?? 'litre';
  const unitPrice = displayProduct.pricePerLitre * unitMultiplier;
  const originalUnitPrice = Math.round(unitPrice * 1.15);

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
            <div className={styles.mainImage}>
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
              <div className={styles.productRating}>
                <RatingBadge rating={averageRating} size="md" />
                <span className={styles.reviewCount}>({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
              </div>
            </div>

            {/* Price Section */}
            <div className={styles.priceSection}>
              <div className={styles.priceContainer}>
                <div className={styles.originalPrice}>
                  ₹{originalUnitPrice} <span className={styles.priceUnit}>/{unitLabel}</span>
                </div>
                <div className={styles.currentPrice}>
                  ₹{unitPrice} <span className={styles.priceUnit}>/{unitLabel}</span>
                </div>
              </div>
              <div className={styles.discountBadge}>
                15% OFF
              </div>
            </div>

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
                      setPincode(val);
                      setShowDeliveryInfo(false);
                    }}
                    maxLength={6}
                    inputMode="numeric"
                    aria-label="Delivery pincode"
                  />
                  <button
                    type="button"
                    className={styles.pincodeCheckButton}
                    onClick={() => {
                      if (pincode.length === 6) {
                        setShowDeliveryInfo(true);
                      }
                    }}
                    disabled={pincode.length !== 6}
                    aria-label="Check delivery"
                  >
                    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.489 31.975c-0.271 0-0.549-0.107-0.757-0.316-0.417-0.417-0.417-1.098 0-1.515l14.258-14.264-14.050-14.050c-0.417-0.417-0.417-1.098 0-1.515s1.098-0.417 1.515 0l14.807 14.807c0.417 0.417 0.417 1.098 0 1.515l-15.015 15.022c-0.208 0.208-0.486 0.316-0.757 0.316z" fill="currentColor"></path>
                    </svg>
                  </button>
                </div>
                {showDeliveryInfo && pincode.length === 6 && (
                  <div className={styles.deliveryInfo}>
                    ✓ Will be delivered by today
                  </div>
                )}
              </div>

              <div className={styles.actionButtons}>
                <button
                  ref={addToCartButtonRef}
                  type="button"
                  className={styles.addToCartButton}
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
                  href={`/subscribe?productId=${displayProduct.id}`}
                  className={styles.buyNowButton}
                  onClick={onClose}
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
              <p className={styles.descriptionText}>{descriptionText}</p>
              <p className={styles.descriptionText} style={{ marginTop: '0.75rem' }}>
                Demo: smooth scrolling content + long text block. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
              </p>
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

            {/* Other Offerings */}
            {relatedProducts.length > 0 && (
              <div className={styles.relatedSection}>
                <h3 className={styles.sectionTitle}>Other Offerings</h3>
                <div className={styles.relatedProductsGrid}>
                  {relatedProducts.map((relatedProduct) => (
                    <Link
                      key={relatedProduct.id}
                      href={`/subscribe?productId=${relatedProduct.id}`}
                      className={styles.relatedProductCard}
                      onClick={onClose}
                    >
                      {relatedProduct.imageUrl ? (
                        <Image
                          src={relatedProduct.imageUrl}
                          alt={relatedProduct.name}
                          width={80}
                          height={80}
                          style={{ objectFit: 'cover', borderRadius: '8px' }}
                        />
                      ) : (
                        <div className={styles.relatedPlaceholder}>🥛</div>
                      )}
                      <div className={styles.relatedProductName}>{relatedProduct.name}</div>
                      <div className={styles.relatedProductPrice}>₹{relatedProduct.pricePerLitre}/L</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons moved above description */}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

