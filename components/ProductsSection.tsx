'use client';

import { useState, useEffect } from 'react';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import ProductDetailsModal from './ProductDetailsModal';
import RatingBadge from '@/components/ui/RatingBadge';
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
                  Assured
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
                <div className={styles.productTitleRow}>
                  <h3 className={styles.productName}>{product.name}</h3>
                  <div className={styles.productRating}>
                    <RatingBadge rating={getAverageRating(product)} size="sm" />
                    {product.reviews && product.reviews.length > 0 && (
                      <span className={styles.reviewCount}>({product.reviews.length})</span>
                    )}
                  </div>
                </div>
                {product.description && (
                  <p className={styles.productDescription}>{product.description}</p>
                )}
                <div className={styles.productPriceRow}>
                  <div className={styles.priceContainer}>
                    <div className={styles.originalPrice}>
                      ₹{Math.round(product.pricePerLitre * 1.15)} <span className={styles.priceUnit}>/litre</span>
                    </div>
                    <div className={styles.productPrice}>
                      ₹{product.pricePerLitre} <span className={styles.priceUnit}>/litre</span>
                    </div>
                  </div>
                  <div className={styles.discountBadge}>
                    15% OFF
                  </div>
                </div>
                <div className={styles.productButtons}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click
                      setSelectedProduct(product);
                      setIsModalOpen(true);
                    }}
                    className={styles.viewDetailsButton}
                  >
                    View Details
                  </button>
                  <Link 
                    href={`/subscribe?productId=${product.id}`} 
                    className={styles.buyNowButton}
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click when clicking Buy Now
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

