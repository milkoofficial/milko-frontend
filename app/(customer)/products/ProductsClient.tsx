'use client';

import { useEffect, useState } from 'react';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Image from 'next/image';
import ProductDetailsModal from '@/components/ProductDetailsModal';
import RatingBadge from '@/components/ui/RatingBadge';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { getCardDiscountOff, getCardDisplayPrice } from '@/lib/utils/productCardPricing';
import styles from './products.module.css';
import cardStyles from '@/components/ProductsSection.module.css';

/**
 * Products Page - Customer View (client component)
 * Displays all active products
 */
export default function ProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { addItem } = useCart();
  const { showToast } = useToast();

  const getAverageRating = (p: Product) => {
    const reviews = p.reviews || [];
    if (reviews.length === 0) return 0;
    return reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  };

  const getDisplayPrice = (p: Product) => getCardDisplayPrice(p);
  const getDiscountOff = (p: Product) => getCardDiscountOff(p);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await productsApi.getAll();
        // LIST omits reviews; match homepage cards by loading details for rating badges
        const withDetails = await Promise.all(
          data.map(async (p) => {
            try {
              return await productsApi.getById(p.id, true);
            } catch {
              return p;
            }
          })
        );
        setProducts(withDetails);
      } catch (error) {
        console.error('Failed to fetch products:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading products...</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Our Products</h1>
      <div className={cardStyles.productsGrid}>
        {products.map((product) => (
          <div
            key={product.id}
            className={cardStyles.productCard}
            onClick={() => {
              setSelectedProduct(product);
              setIsModalOpen(true);
            }}
          >
            <div className={cardStyles.productImage}>
              <div className={cardStyles.assuredBadge}>
                <svg className={cardStyles.verifiedIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
                <div className={cardStyles.placeholderImage}>
                  <span>🥛</span>
                </div>
              )}
            </div>

            <div className={cardStyles.productInfo}>
              <div className={cardStyles.productCategory}>{(product as any).category || 'Dairy'}</div>

              <div className={cardStyles.productTitleRow}>
                <h3 className={cardStyles.productName}>{product.name}</h3>
                <div className={cardStyles.productRating}>
                  {(product.reviews?.length ?? 0) > 0 ? (
                    <>
                      <RatingBadge rating={getAverageRating(product)} size="sm" />
                      <span className={cardStyles.reviewCount}>
                        ({(product.reviews?.length ?? 0) >= 1000
                          ? `${((product.reviews?.length ?? 0) / 1000).toFixed(1)}k`
                          : (product.reviews?.length ?? 0)})
                      </span>
                    </>
                  ) : (
                    <>
                      <svg className={cardStyles.starIconEmpty} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.563.563 0 00-.182-.557L3.04 10.385a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345l2.125-5.111z" />
                      </svg>
                      <span className={cardStyles.reviewCount}>(0)</span>
                    </>
                  )}
                </div>
              </div>

              {(() => {
                const off = getDiscountOff(product);
                return off ? <div className={cardStyles.discountOff}>₹ {off.toFixed(0)} OFF</div> : null;
              })()}

              <div className={cardStyles.addToCartRow}>
                <div className={cardStyles.priceDisplay}>
                  <span className={cardStyles.priceAmount}>₹{getDisplayPrice(product)}</span>
                  <span className={cardStyles.priceUnit}>/{product.suffixAfterPrice || 'litre'}</span>
                </div>
                <button
                  className={cardStyles.addToCartButton}
                  disabled={product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0)}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0)) {
                      showToast('Out of stock', 'error');
                      return;
                    }
                    const result = addItem({ productId: product.id, quantity: 1 }, product.maxQuantity);
                    showToast(result.appliedQuantity > 0 ? 'Added to cart' : `Maximum order quantity is ${product.maxQuantity ?? 99}`, result.appliedQuantity > 0 ? 'success' : 'error');
                  }}
                  aria-label={product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0) ? 'Out of stock' : 'Add to cart'}
                  type="button"
                >
                  {product.isActive === false || (typeof product.quantity === 'number' && product.quantity <= 0) ? 'Out of Stock' : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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

      {products.length === 0 && (
        <p style={{ textAlign: 'center', marginTop: '2rem', color: '#666' }}>
          No products available at the moment.
        </p>
      )}
    </div>
  );
}

