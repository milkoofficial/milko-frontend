'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';

/**
 * Search Results Page
 * Displays products matching the search query
 */
export default function SearchPage() {
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

  if (loading) {
    return (
      <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#666' }}>Searching...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', minHeight: '50vh' }}>
      {query.trim() ? (
        <>
          {products.length > 0 ? (
            <>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem', letterSpacing: '-1.5px' }}>
                Search results for &quot;{query}&quot;
              </h1>
              <p style={{ color: '#666', marginBottom: '2rem' }}>
                Found {products.length} product{products.length !== 1 ? 's' : ''}
              </p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
                gap: '2rem',
              }}>
                {products.map((product) => (
                  <div key={product.id} style={{ 
                    border: '1px solid #e0e0e0', 
                    borderRadius: '8px', 
                    padding: '1.5rem',
                    background: '#fff',
                    transition: 'box-shadow 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  >
                    {product.imageUrl && (
                      <Image
                        src={product.imageUrl}
                        alt={product.name}
                        width={300}
                        height={200}
                        style={{ width: '100%', height: '200px', objectFit: 'cover', borderRadius: '4px' }}
                      />
                    )}
                    <h2 style={{ marginTop: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>{product.name}</h2>
                    {product.description && (
                      <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.95rem' }}>
                        {product.description}
                      </p>
                    )}
                    <p style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '1rem', color: '#000' }}>
                      ₹{product.pricePerLitre} per litre
                    </p>
                    <Link 
                      href={`/subscribe?productId=${product.id}`}
                      style={{
                        display: 'inline-block',
                        marginTop: '1rem',
                        padding: '0.75rem 1.5rem',
                        background: '#000',
                        color: 'white',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textDecoration: 'none',
                        fontSize: '0.95rem',
                        fontWeight: '600',
                        transition: 'background-color 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#333';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#000';
                      }}
                    >
                      Subscribe Now
                    </Link>
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
              <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '-1.5px', color: '#000' }}>
                Search for &quot;{query}&quot;
              </h1>
              <p style={{ color: '#666', marginBottom: '2rem', fontSize: '1rem' }}>
                No products found matching your search.
              </p>
              <Link 
                href="/"
                style={{
                  display: 'inline-block',
                  padding: '0.875rem 1.75rem',
                  background: '#000',
                  color: '#fff',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#333';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#000';
                }}
              >
                Browse All Products
              </Link>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem', letterSpacing: '-1.5px', color: '#000' }}>
            Search Products
          </h1>
          <p style={{ color: '#666', marginBottom: '2rem' }}>
            Enter a search term to find products.
          </p>
          <Link 
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.875rem 1.75rem',
              background: '#000',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.95rem',
              fontWeight: '600',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#333';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#000';
            }}
          >
            Browse All Products
          </Link>
        </div>
      )}
    </div>
  );
}
