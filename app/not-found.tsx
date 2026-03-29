import Link from 'next/link';

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>404</h1>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
        Page not found
      </h2>
      <p style={{ marginBottom: '1.5rem', color: '#666' }}>
        The page you’re looking for doesn’t exist or was moved.
      </p>
      <Link
        href="/"
        style={{
          padding: '0.5rem 1.25rem',
          fontSize: '1rem',
          background: '#1a1a1a',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          textDecoration: 'none',
          display: 'inline-block',
        }}
      >
        Go home
      </Link>
    </div>
  );
}
