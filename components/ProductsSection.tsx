'use client';

import { useState, useEffect } from 'react';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import ProductDetailsModal from './ProductDetailsModal';
import RatingBadge from '@/components/ui/RatingBadge';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { animateToCart } from '@/lib/utils/cartAnimation';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import styles from './ProductsSection.module.css';

/**
 * Products Section Component
 * Displays products in a grid (4 per row)
 * Shows 4 demo products on homepage
 */
export default function ProductsSection() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();

  // Fallback demo products
  const fallbackProducts: Product[] = [
    {
      id: '1',
      name: 'Fresh Cow Milk',
      description: 'Pure, fresh cow milk delivered daily. ✅ Farm-fresh • 🥛 Rich taste • 🚚 Morning delivery',
      pricePerLitre: 60,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Buffalo Milk',
      description: 'Rich and creamy buffalo milk. 🐃 Higher fat • Perfect for tea/coffee • Daily delivery',
      pricePerLitre: 70,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Toned Milk',
      description: 'Light and healthy toned milk. 🌿 Balanced nutrition • Great for fitness • Fresh daily',
      pricePerLitre: 55,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      name: 'Full Cream Milk',
      description: 'Premium full cream milk. ⭐ Extra creamy • Family pack favourite • Delivered chilled',
      pricePerLitre: 65,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    const fetchProducts = async () => {
      // Set a timeout to show fallback products if API takes too long
      const timeoutId = setTimeout(() => {
        setProducts(fallbackProducts);
        setLoading(false);
      }, 2000); // 2 second timeout

      try {
        const data = await productsApi.getAll();
        clearTimeout(timeoutId);
        // Show only first 4 products for homepage, or fallback if empty
        if (data && data.length > 0) {
          const base = data.slice(0, 4);
          // Fetch details (incl. reviews) for accurate rating badges (only 4 items → OK)
          const withDetails = await Promise.all(
            base.map(async (p) => {
              try {
                return await productsApi.getById(p.id, true);
              } catch {
                return p;
              }
            })
          );
          setProducts(withDetails);
        } else {
          setProducts(fallbackProducts);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Failed to fetch products:', error);
        // Use fallback products if API fails
        setProducts(fallbackProducts);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const getAverageRating = (p: Product) => {
    const reviews = p.reviews || [];
    if (reviews.length === 0) return 5;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  };

  const getDisplayPrice = (p: Product) => {
    return (p.sellingPrice !== null && p.sellingPrice !== undefined) ? p.sellingPrice : p.pricePerLitre;
  };

  const getDiscountOff = (p: Product) => {
    const selling = getDisplayPrice(p);
    const compare = p.compareAtPrice;
    if (compare === null || compare === undefined) return null;
    if (typeof selling !== 'number' || typeof compare !== 'number') return null;
    const off = compare - selling;
    return off > 0 ? off : null;
  };

  // Render shimmer skeletons while loading
  if (loading) {
    return (
      <div className={styles.productsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our Products</h2>
          <div className={styles.productsGrid}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={styles.productCardShimmer}>
                <div className={`${styles.productImageShimmer} ${styles.shimmer}`}></div>
                <div className={styles.productInfoShimmer}>
                  <div className={`${styles.titleShimmer} ${styles.shimmer}`}></div>
                  <div className={`${styles.descriptionShimmer} ${styles.shimmer}`}></div>
                  <div className={`${styles.descriptionShimmer} ${styles.shimmer}`} style={{ width: '70%' }}></div>
                  <div className={styles.priceRowShimmer}>
                    <div className={`${styles.priceShimmer} ${styles.shimmer}`}></div>
                    <div className={`${styles.discountShimmer} ${styles.shimmer}`}></div>
                  </div>
                  <div className={styles.buttonsShimmer}>
                    <div className={`${styles.buttonShimmer} ${styles.shimmer}`}></div>
                    <div className={`${styles.buttonShimmer} ${styles.shimmer}`}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.productsSection}>
      <div className={styles.container}>
        <h2 className={styles.sectionTitle}>Our Products</h2>
        <div className={styles.productsGrid}>
          {products.map((product) => (
            <div 
              key={product.id} 
              className={styles.productCard}
              onClick={() => {
                setSelectedProduct(product);
                setIsModalOpen(true);
              }}
            >
              <div className={styles.productImage}>
                {/* Assured Badge */}
                <div className={styles.assuredBadge}>
                  <svg className={styles.verifiedIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>Assured</span>
                </div>
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
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
              <div className={styles.productInfo}>
                <div className={styles.productCategory}>
                  {(product as any).category || 'Dairy'}
                </div>
                <div className={styles.productTitleRow}>
                  <h3 className={styles.productName}>{product.name}</h3>
                  <div className={styles.productRating}>
                    <RatingBadge rating={getAverageRating(product)} size="sm" />
                    {product.reviews && product.reviews.length > 0 && (
                      <span className={styles.reviewCount}>
                        ({product.reviews.length >= 1000 
                          ? `${(product.reviews.length / 1000).toFixed(1)}k` 
                          : product.reviews.length})
                      </span>
                    )}
                  </div>
                </div>
                {(() => {
                  const off = getDiscountOff(product);
                  return off ? (
                    <div className={styles.discountOff}>
                      ₹ {off.toFixed(0)} OFF
                    </div>
                  ) : null;
                })()}
                <div className={styles.addToCartRow}>
                  <div className={styles.priceDisplay}>
                    <span className={styles.priceAmount}>₹{getDisplayPrice(product)}</span>
                    <span className={styles.priceUnit}>/{product.suffixAfterPrice || 'litre'}</span>
                  </div>
                  <button
                    className={styles.addToCartButton}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      
                      // Add to cart
                      addItem({
                        productId: product.id,
                        quantity: 1,
                      });
                      
                      // Show notification
                      showToast('Added to cart', 'success');

                      // Get product image URL for animation
                      const imageUrl = product.imageUrl || '';
                      
                      // Get source and target elements for animation
                      const sourceElement = e.currentTarget;
                      const targetElement = cartIconRefStore.getAny();

                      // Animate if we have both elements
                      if (sourceElement && targetElement) {
                        // Wait a tiny bit to ensure cart icon is visible
                        setTimeout(() => {
                          // Re-get target position in case it moved
                          const updatedTarget = cartIconRefStore.getAny();
                          if (!updatedTarget) return;

                          const sourceRect = sourceElement.getBoundingClientRect();
                          
                          // Try to get the cart button Link element (parent of the wrapper)
                          let cartButtonElement = updatedTarget.closest('a[href="/cart"]') as HTMLElement;
                          if (!cartButtonElement) {
                            cartButtonElement = updatedTarget;
                          }
                          
                          // Find the cart badge (where the number is displayed)
                          // The badge is inside the cartIconWrapper div
                          const cartBadge = cartButtonElement.querySelector('[class*="cartBadge"], .cartBadge') as HTMLElement;
                          let targetRect: DOMRect;
                          
                          if (cartBadge) {
                            // Use badge position (where the number is)
                            targetRect = cartBadge.getBoundingClientRect();
                          } else {
                            // Fallback to cart button, but position it lower (where badge would be)
                            // Badge is typically positioned at top-left of cart icon, so we'll target that area
                            targetRect = cartButtonElement.getBoundingClientRect();
                          }

                          // Calculate positions
                          const startX = sourceRect.left + sourceRect.width / 2;
                          const startY = sourceRect.top + sourceRect.height / 2;
                          const targetX = targetRect.left + targetRect.width / 2;
                          
                          // Position Y at the badge center (where the number is)
                          // The badge is positioned at top: -8px relative to cart icon
                          let targetY: number;
                          if (cartBadge) {
                            // Use the badge's center position - this is where the number is
                            targetY = targetRect.top + targetRect.height / 2;
                          } else {
                            // Fallback: position at cart icon but adjust for badge position
                            // Badge is at top: -8px, height: 20px, so center is at top + 10px
                            const cartButtonRect = cartButtonElement.getBoundingClientRect();
                            // Get the cart icon wrapper to find badge position
                            const cartIconWrapper = cartButtonElement.querySelector('[class*="cartIconWrapper"]') as HTMLElement;
                            if (cartIconWrapper) {
                              const wrapperRect = cartIconWrapper.getBoundingClientRect();
                              // Badge is 8px above wrapper, center is at wrapper.top - 8 + 10
                              targetY = wrapperRect.top - 8 + 10;
                            } else {
                              targetY = cartButtonRect.top - 8 + 10;
                            }
                          }

                          // Verify direction - cart should be on the right
                          // If targetX < startX, something is wrong with the layout
                          // In that case, we'll use the right side of the screen where cart should be
                          const finalTargetX = targetX > startX ? targetX : window.innerWidth - 100;
                          
                          // Ensure targetY doesn't go out of screen, but prioritize badge position
                          // Only clamp if it's actually going out of bounds
                          const minY = 15; // Minimum safe distance from top
                          const maxY = window.innerHeight - 20; // Above bottom
                          // Only clamp if it's going out of bounds, otherwise use exact badge position
                          const finalTargetY = targetY < minY ? minY : (targetY > maxY ? maxY : targetY);

                          // If no image, create a circular glow effect
                          if (!imageUrl) {
                            const glow = document.createElement('div');
                            glow.style.position = 'fixed';
                            glow.style.width = '40px';
                            glow.style.height = '40px';
                            glow.style.borderRadius = '50%';
                            glow.style.background = 'radial-gradient(circle, #0070f3 0%, #0051cc 100%)';
                            glow.style.boxShadow = '0 100px 200px rgba(0, 112, 243, 0.6), 0 100px 400px rgba(0, 112, 243, 0.4)';
                            glow.style.zIndex = '10000';
                            glow.style.pointerEvents = 'none';
                            glow.style.transition = 'none';
                            glow.style.left = `${startX - 20}px`;
                            glow.style.top = `${startY - 20}px`;
                            document.body.appendChild(glow);

                            // Force reflow
                            glow.offsetHeight;

                            const duration = 600;
                            const startTime = performance.now();

                            function animateGlow(currentTime: number) {
                              const elapsed = currentTime - startTime;
                              const progress = Math.min(elapsed / duration, 1);
                              
                              // Easing function (ease-in-out-cubic)
                              const ease = progress < 0.5
                                ? 4 * progress * progress * progress
                                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                              // Calculate current position - ensure it goes to the right
                              const currentX = startX + (finalTargetX - startX) * ease;
                              let currentY = startY + (finalTargetY - startY) * ease;
                              
                              // Safety check: ensure Y never goes above screen (keep at least 20px from top)
                              const minSafeY = 20;
                              currentY = Math.max(minSafeY, currentY);
                              
                              const scale = 1 - (progress * 0.6);
                              const opacity = 1 - progress * 0.4;

                              glow.style.left = `${currentX - 20}px`;
                              glow.style.top = `${currentY - 20}px`;
                              glow.style.transform = `scale(${scale})`;
                              glow.style.opacity = `${opacity}`;

                              if (progress < 1) {
                                requestAnimationFrame(animateGlow);
                              } else {
                                // Ensure it stops exactly at the cart badge (where the number is)
                                glow.style.left = `${finalTargetX - 20}px`;
                                glow.style.top = `${finalTargetY - 20}px`;
                                // Wait a bit before removing to show it reached the target
                                setTimeout(() => {
                                  if (glow.parentNode) {
                                    document.body.removeChild(glow);
                                  }
                                }, 100);
                              }
                            }

                            requestAnimationFrame(animateGlow);
                          } else {
                            // Use product image animation with updated target
                            animateToCart({
                              imageUrl,
                              sourceElement,
                              targetElement: updatedTarget,
                            });
                          }
                        }, 10);
                      }
                    }}
                    aria-label="Add to cart"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.viewAllLink}>
          <Link href="/products" className={styles.viewAllButton}>
            <span>View All Products</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      </div>

      {/* Product Details Modal */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedProduct(null);
          }}
          onRelatedProductClick={(relatedProduct) => {
            // Close current modal and open new one with related product
            setSelectedProduct(relatedProduct);
            // Modal will automatically update since selectedProduct changes
          }}
        />
      )}
    </div>
  );
}

