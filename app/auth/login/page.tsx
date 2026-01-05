'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminDomain, getPostLoginRedirect } from '@/lib/utils/domain';
import Link from 'next/link';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';

/**
 * Login Page
 * Modern, clean design inspired by iDenfy
 * Domain-aware: Shows different UI for admin.milko.in vs milko.in
 */
export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const isAdmin = isAdminDomain();
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname.includes('localhost');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const redirectPath = getPostLoginRedirect(user.role);
      if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath;
      } else {
        router.push(redirectPath);
      }
    }
  }, [isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTouched({ email: true, password: true });

    // Validate required fields
    if (!email || !password) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);

    try {
      const response = await login(email, password);
      const redirectPath = getPostLoginRedirect(response.user.role);
      
      // If admin logged in on customer domain, redirect to admin subdomain
      // In local development we keep admin and customer routes on the same origin.
      if (response.user.role === 'admin' && !isAdmin && !isLocalhost) {
        window.location.href = `https://admin.milko.in${redirectPath}`;
      } else if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath;
      } else {
        router.push(redirectPath);
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: '#f5f5f5',
      padding: '3rem',
    }}>
      {/* Logo */}
      <div style={{ 
        marginBottom: '2rem',
        textAlign: 'center'
      }}>
        <h1 style={{ 
          fontSize: '2rem',
          fontWeight: 600,
          color: '#1a1a1a',
          letterSpacing: '-0.5px',
          margin: 0
        }}>
          Milko
        </h1>
      </div>

      {/* Login Card */}
      <div style={{ 
        background: 'white', 
        padding: '2.5rem',
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        width: '100%',
        maxWidth: '440px'
      }}>
        {/* Title */}
        <h2 style={{ 
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#1a1a1a',
          marginBottom: '0.5rem',
          letterSpacing: '-1px',
          textAlign: 'center'
        }}>
          Log in to your account
        </h2>
        
        {/* Subtitle */}
        <p style={{ 
          fontSize: '0.85rem',
          color: '#666',
          marginBottom: '2rem',
          lineHeight: '1.5',
          textAlign: 'center'
        }}>
          Welcome back! Please enter your details to log in.
        </p>
        
        {/* Error Message */}
        {error && (
          <div style={{ 
            padding: '0.75rem 1rem', 
            background: '#fee', 
            color: '#c33', 
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Email Field */}
          <FloatingLabelInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, email: true }))}
            label="Email"
            required
            hasError={touched.email && !email}
          />

          {/* Password Field */}
          <div style={{ marginBottom: '1.5rem' }}>
            <FloatingLabelInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, password: true }))}
              label="Password"
              required
              showPasswordToggle
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword(!showPassword)}
              hasError={touched.password && !password}
            />
          </div>

          {/* Login Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#93c5fd' : '#007cff',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
              marginBottom: '1.5rem',
              transition: 'background-color 0.2s',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#1d4ed8';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.background = '#2563eb';
              }
            }}
          >
            {loading ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        {/* Sign Up Link */}
        {!isAdmin && (
          <p style={{ 
            textAlign: 'center', 
            color: '#666',
            fontSize: '0.9rem',
            margin: 0
          }}>
            Don&apos;t have an account?{' '}
            <Link 
              href="/auth/signup" 
              style={{ 
                color: '#0070f3',
                textDecoration: 'none',
                fontWeight: 500
              }}
            >
              Sign up
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

