'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types';
import { productsApi } from '@/lib/api';
import Image from 'next/image';
import Link from 'next/link';
import styles from './ProductDetailsModal.module.css';

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
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [productDetails, setProductDetails] = useState<Product | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [loadingRelated, setLoadingRelated] = useState(false);

  useEffect(() => {
    if (isOpen) {
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

  // Get variations from product details
  const variations = displayProduct.variations || [];

  // Get reviews from product details
  const reviews = displayProduct.reviews || [];

  // Calculate average rating
  const averageRating = reviews.length > 0
    ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
    : 5; // Default to 5 if no reviews

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

        <div className={styles.modalBody}>
          {/* Left Side - Images */}
          <div className={styles.imageSection}>
            {/* Main Image */}
            <div className={styles.mainImage}>
              {productImages[selectedImageIndex] ? (
                <Image
                  src={productImages[selectedImageIndex]}
                  alt={product.name}
                  fill
                  style={{ objectFit: 'cover' }}
                />
              ) : (
                <div className={styles.placeholderImage}>
                  <span>🥛</span>
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {productImages.length > 1 && (
              <div className={styles.thumbnailContainer}>
                {productImages.map((image, index) => (
                  <button
                    key={index}
                    className={`${styles.thumbnail} ${selectedImageIndex === index ? styles.thumbnailActive : ''}`}
                    onClick={() => setSelectedImageIndex(index)}
                  >
                    {image ? (
                      <Image
                        src={image}
                        alt={`${product.name} ${index + 1}`}
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      <span>🥛</span>
                    )}
                  </button>
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
                <div className={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <svg 
                      key={star} 
                      className={styles.starIcon} 
                      viewBox="0 0 24 24" 
                      fill={star <= Math.round(averageRating) ? "currentColor" : "none"}
                      stroke={star <= Math.round(averageRating) ? "none" : "currentColor"}
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                    </svg>
                  ))}
                </div>
                <span className={styles.reviewCount}>({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
              </div>
            </div>

            {/* Price Section */}
            <div className={styles.priceSection}>
              <div className={styles.priceContainer}>
                <div className={styles.originalPrice}>
                  ₹{Math.round(displayProduct.pricePerLitre * 1.15)} <span className={styles.priceUnit}>/litre</span>
                </div>
                <div className={styles.currentPrice}>
                  ₹{displayProduct.pricePerLitre} <span className={styles.priceUnit}>/litre</span>
                </div>
              </div>
              <div className={styles.discountBadge}>
                15% OFF
              </div>
            </div>

            {/* Description */}
            {displayProduct.description && (
              <div className={styles.descriptionSection}>
                <h3 className={styles.sectionTitle}>Description</h3>
                <p className={styles.descriptionText}>{displayProduct.description}</p>
              </div>
            )}

            {/* Variations */}
            {variations.length > 0 && (
              <div className={styles.variationsSection}>
                <h3 className={styles.sectionTitle}>Available Sizes</h3>
                <div className={styles.variationsGrid}>
                  {variations.map((variation) => {
                    const price = displayProduct.pricePerLitre * variation.priceMultiplier;
                    return (
                      <button 
                        key={variation.id}
                        className={`${styles.variationButton} ${variation.isAvailable ? '' : styles.variationDisabled}`}
                        disabled={!variation.isAvailable}
                        title={!variation.isAvailable ? 'Not available' : `${variation.size} - ₹${price.toFixed(2)}`}
                      >
                        {variation.size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <svg 
                                    key={star} 
                                    className={styles.starIconSmall} 
                                    viewBox="0 0 24 24" 
                                    fill={star <= review.rating ? "currentColor" : "none"}
                                    stroke={star <= review.rating ? "none" : "currentColor"}
                                    xmlns="http://www.w3.org/2000/svg"
                                  >
                                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                                  </svg>
                                ))}
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

            {/* Loading State */}
            {loadingDetails && (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
                Loading product details...
              </div>
            )}

            {/* Action Buttons */}
            <div className={styles.actionButtons}>
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
        </div>
      </div>
    </div>
  );
}

