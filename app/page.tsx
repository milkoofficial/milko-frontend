import Link from 'next/link';

/**
 * Home Page
 * Shows different content based on authentication status
 */
export default function HomePage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Welcome to Milko.in</h1>
      <p>Fresh milk delivered to your doorstep daily</p>
      <div style={{ marginTop: '2rem' }}>
        <Link href="/products" style={{ marginRight: '1rem', padding: '0.5rem 1rem', background: '#0070f3', color: 'white', borderRadius: '4px' }}>
          Browse Products
        </Link>
        <Link href="/auth/login" style={{ padding: '0.5rem 1rem', background: '#333', color: 'white', borderRadius: '4px' }}>
          Login
        </Link>
      </div>
    </div>
  );
}

