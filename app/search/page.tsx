'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import styles from '@/components/ProductsSection.module.css';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import RatingBadge from '@/components/ui/RatingBadge';

/**
 * Search Results Page
 * Displays products matching the search query
 */
function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const searchProducts = async () => {
      if (!query.trim()) {
        setProducts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Get all products and filter on client side
        // TODO: Replace with API search endpoint when available
        const allProducts = await productsApi.getAll();
        const searchTerm = query.toLowerCase().trim();
        const filtered = allProducts.filter((product) => {
          // Filter out DEMO products
          const isDemo = product.name.toLowerCase().includes('demo') || 
                        product.description?.toLowerCase().includes('demo');
          if (isDemo) return false;
          
          // Filter by search term
          const nameMatch = product.name.toLowerCase().includes(searchTerm);
          const descMatch = product.description?.toLowerCase().includes(searchTerm);
          return nameMatch || descMatch;
        });
        setProducts(filtered);
      } catch (error) {
        console.error('Failed to search products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    searchProducts();
  }, [query]);

  const getAverageRating = (p: Product) => {
    const reviews = p.reviews || [];
    if (reviews.length === 0) return 0;
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

  if (loading) {
    return (
      <div className={styles.productsSection}>
        <div className={styles.container}>
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <p className={styles.loading}>Searching...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.productsSection}>
      <div className={styles.container}>
        {query.trim() ? (
          <>
            {products.length > 0 ? (
              <>
                <h1 className={styles.sectionTitle}>
                  Search results for &quot;{query}&quot;
                </h1>
                <p style={{ color: '#666', marginBottom: '2rem', textAlign: 'center' }}>
                  Found {products.length} product{products.length !== 1 ? 's' : ''}
                </p>
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
                            {(product.reviews?.length ?? 0) > 0 ? (
                              <>
                                <RatingBadge rating={getAverageRating(product)} size="sm" />
                                <span className={styles.reviewCount}>
                                  ({(product.reviews?.length ?? 0) >= 1000
                                    ? `${((product.reviews?.length ?? 0) / 1000).toFixed(1)}k`
                                    : (product.reviews?.length ?? 0)})
                                </span>
                              </>
                            ) : (
                              <>
                                <svg className={styles.starIconEmpty} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                  <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
                                </svg>
                                <span className={styles.reviewCount}>(0)</span>
                              </>
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
                          <Link
                            href={`/subscribe?productId=${product.id}`}
                            className={styles.addToCartButton}
                            onClick={(e) => {
                              e.stopPropagation(); // Prevent card click
                            }}
                            aria-label="Subscribe Now"
                          >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <svg
                  viewBox="0 0 400 400"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ width: '120px', height: '120px', margin: '0 auto 2rem', display: 'block' }}
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path d="M102.125 172.839C54.7551 235.791 48.0015 293.96 48.0015 358.802" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M102.127 172.839C112.108 211.439 135.434 277.795 135.434 315.781" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M239.518 264.433C213.65 264.433 169.98 298.927 138.209 315.781" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M244.768 263.706C249.159 263.939 253.393 265.447 257.646 266.567" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M240.901 274.147C244.213 274.487 247.407 276.681 250.615 278.311" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M338.919 157.733C340.939 144.264 337.021 134.241 329.704 129.879C320.415 124.341 306.18 126.646 294.174 140.144C234.303 207.45 303.365 267.433 336.284 167.065" stroke="#000000" strokeOpacity="0.5" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M271.896 228.351C256.447 251.963 241.631 280.024 226.1 303.291" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M190.709 38.6922C194.837 40.2666 196.907 44.8895 195.333 49.0178C193.759 53.146 189.136 55.2163 185.008 53.6419L190.709 38.6922ZM107.484 121.21L99.7221 123.147V123.147L107.484 121.21ZM203.668 55.5181C199.881 53.2421 198.656 48.3271 200.932 44.5402C203.208 40.7532 208.123 39.5283 211.91 41.8043L203.668 55.5181ZM115.246 119.273C123.042 150.508 138.113 163.3 153.165 166.64C168.914 170.135 187.524 163.989 203.183 151.387C218.792 138.824 229.947 121.027 231.726 103.633C233.429 86.9729 226.697 69.3591 203.668 55.5181L211.91 41.8043C239.737 58.5289 250.036 81.8529 247.643 105.26C245.324 127.933 231.255 149.332 213.214 163.852C195.222 178.332 171.755 187.154 149.699 182.26C126.945 177.211 108.485 158.258 99.7221 123.147L115.246 119.273ZM185.008 53.6419C159.208 43.8026 139.858 50.6989 127.879 63.9823C115.47 77.7426 110.234 99.1929 115.246 119.273L99.7221 123.147C93.5165 98.2833 99.7656 71.2655 115.997 53.2671C132.658 34.7918 159.103 26.6385 190.709 38.6922L185.008 53.6419Z" fill="#000000" fillOpacity="0.9"></path>
                    <path d="M200.539 121.09C201.081 118.803 201.752 118.543 202.334 116.314" stroke="#000000" strokeOpacity="0.9" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
                <h1 className={styles.sectionTitle}>
                  Search for &quot;{query}&quot;
                </h1>
                <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1rem' }}>
                  No products found matching your search.
                </p>
                <Link 
                  href="/"
                  className={styles.viewAllButton}
                >
                  <span>Browse All Products</span>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <h1 className={styles.sectionTitle}>
              Search Products
            </h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              Enter a search term to find products.
            </p>
            <Link 
              href="/"
              className={styles.viewAllButton}
            >
              <span>Browse All Products</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        )}
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
            setSelectedProduct(relatedProduct);
          }}
        />
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#666' }}>Loading...</p>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
