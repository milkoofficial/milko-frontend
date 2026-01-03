'use client';

import { useState, useEffect } from 'react';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import ProductDetailsModal from './ProductDetailsModal';
import styles from './ProductsSection.module.css';

/**
 * Products Section Component
 * Displays products in a grid (3 per row)
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
      description: 'Pure, fresh cow milk delivered daily',
      pricePerLitre: 60,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Buffalo Milk',
      description: 'Rich and creamy buffalo milk',
      pricePerLitre: 70,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Toned Milk',
      description: 'Light and healthy toned milk',
      pricePerLitre: 55,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      name: 'Full Cream Milk',
      description: 'Premium full cream milk',
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
          setProducts(data.slice(0, 4));
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

  if (loading) {
    return (
      <div className={styles.productsSection}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our Products</h2>
          <div className={styles.loading}>Loading products...</div>
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
            <div key={product.id} className={styles.productCard}>
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
                    <div className={styles.starsContainer}>
                      <svg className={styles.starIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                      </svg>
                      <svg className={styles.starIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                      </svg>
                      <svg className={styles.starIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                      </svg>
                      <svg className={styles.starIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                      </svg>
                      <svg className={styles.starIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor"/>
                      </svg>
                    </div>
                    <span className={styles.reviewCount}>(24)</span>
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
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsModalOpen(true);
                    }}
                    className={styles.viewDetailsButton}
                  >
                    View Details
                  </button>
                  <Link href={`/subscribe?productId=${product.id}`} className={styles.buyNowButton}>
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
        />
      )}
    </div>
  );
}

