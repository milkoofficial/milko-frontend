'use client';

import { useState, useEffect } from 'react';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import ProductDetailsModal from './ProductDetailsModal';
import RatingBadge from '@/components/ui/RatingBadge';
import { useCart } from '@/contexts/CartContext';
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
                  const originalPrice = Math.round(product.pricePerLitre * 1.15);
                  const discount = originalPrice - product.pricePerLitre;
                  return discount > 0 ? (
                    <div className={styles.discountOff}>
                      ₹ {discount.toFixed(1)} OFF
                    </div>
                  ) : null;
                })()}
                <div className={styles.addToCartRow}>
                  <div className={styles.priceDisplay}>
                    <span className={styles.priceAmount}>₹{product.pricePerLitre}</span>
                    <span className={styles.priceUnit}>/litre</span>
                  </div>
                  <button
                    className={styles.addToCartButton}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      addItem({
                        productId: product.id,
                        quantity: 1,
                      });
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
          <Link href="/products">View All Products →</Link>
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

