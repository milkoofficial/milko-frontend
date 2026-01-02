'use client';

import { useEffect, useState } from 'react';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import Link from 'next/link';
import Image from 'next/image';

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
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Our Products</h1>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: '2rem',
        marginTop: '2rem'
      }}>
        {products.map((product) => (
          <div key={product.id} style={{ 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px', 
            padding: '1.5rem',
            background: '#fff'
          }}>
            {product.imageUrl && (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={300}
                height={200}
                style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
              />
            )}
            <h2 style={{ marginTop: '1rem' }}>{product.name}</h2>
            {product.description && <p style={{ color: '#666', marginTop: '0.5rem' }}>{product.description}</p>}
            <p style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1rem' }}>
              ₹{product.pricePerLitre} per litre
            </p>
            <Link 
              href={`/subscribe?productId=${product.id}`}
              style={{
                display: 'inline-block',
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                background: '#0070f3',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
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

