'use client';

import { useEffect, useState } from 'react';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Link from 'next/link';
import Image from 'next/image';
import styles from './products.module.css';

/**
 * Products Page - Customer View
 * Displays all active products
 */
export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await productsApi.getAll();
        setProducts(data);
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
      <div className={styles.productsGrid}>
        {products.map((product) => (
          <div key={product.id} className={styles.productCard}>
            {product.imageUrl && (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={300}
                height={220}
                className={styles.productImage}
              />
            )}
            <div className={styles.productCategory}>
              {(product as any).category || 'Dairy'}
            </div>
            <h2 className={styles.productName}>{product.name}</h2>
            <p className={styles.productPrice}>
              ₹{product.pricePerLitre} <span className={styles.priceUnit}>per litre</span>
            </p>
            <Link 
              href={`/subscribe?productId=${product.id}`}
              className={styles.subscribeButton}
            >
              Subscribe Now
            </Link>
          </div>
        ))}
      </div>
      {products.length === 0 && (
        <p style={{ textAlign: 'center', marginTop: '2rem', color: '#666' }}>
          No products available at the moment.
        </p>
      )}
    </div>
  );
}

