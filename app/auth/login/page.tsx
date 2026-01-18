'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminDomain, getPostLoginRedirect } from '@/lib/utils/domain';
import Link from 'next/link';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import styles from '../auth.module.css';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

const OAUTH_STATE_MSG =
  'Google sign-in could not be completed. This can happen with strict privacy settings or ad blockers. Try a normal (non-incognito) window, Chrome or Firefox, or use email and password below.';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, isAuthenticated, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const isAdmin = isAdminDomain();

  // Show message when redirected after OAuth bad_oauth_state
  useEffect(() => {
    if (searchParams?.get('error') === 'oauth_state') {
      setError(OAUTH_STATE_MSG);
      router.replace('/auth/login', { scroll: false });
    }
  }, [searchParams, router]);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      const userRole = user.role?.toLowerCase() || 'customer';
      console.log('[LOGIN] Already authenticated, user role:', user.role, 'normalized:', userRole);
      const redirectPath = getPostLoginRedirect(userRole);
      console.log('[LOGIN] Redirect path for authenticated user:', redirectPath);
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
      
      // Normalize role to lowercase for comparison
      const userRole = response.user.role?.toLowerCase() || 'customer';
      console.log('[LOGIN] User role after login:', response.user.role, 'normalized:', userRole);
      
      const redirectPath = getPostLoginRedirect(userRole as 'admin' | 'customer');
      console.log('[LOGIN] Redirect path:', redirectPath);
      
      // If redirect path is an absolute URL (shouldn't happen now), use it
      // Otherwise, use router.push for same-domain navigation
      if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath;
      } else {
        console.log('[LOGIN] Redirecting to:', redirectPath);
        router.push(redirectPath);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      // Handle timeout errors specifically
      if (err.message?.includes('timeout') || err.message?.includes('timed out')) {
        setError('Connection timed out. Please check your internet connection and try again.');
      } else if (err.message) {
        setError(err.message);
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.authContainer} style={{ 
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
      <div className={styles.authCard} style={{ 
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

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '1rem' }}>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
            <span style={{ fontSize: '0.8rem', color: '#999' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
          </div>

          {/* Google Sign In */}
          <button
            type="button"
            onClick={() => loginWithGoogle()}
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'white',
              color: '#1a1a1a',
              border: '1px solid #ddd',
              borderRadius: '8px',
              fontSize: '0.95rem',
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: '1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontFamily: 'inherit',
            }}
          >
            <GoogleIcon />
            Continue with Google
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

      {/* Terms and Privacy Policy - Outside the card */}
      <p style={{ 
        textAlign: 'center', 
        color: '#999',
        fontSize: '0.75rem',
        margin: 0,
        marginTop: '1.5rem',
        lineHeight: '1.4',
        width: '100%',
        maxWidth: '440px'
      }}>
        By continuing, you agree to our Terms of service & Privacy policy
      </p>
    </div>
  );
}

/**
 * Login Page – wraps LoginForm in Suspense (useSearchParams requires it for static prerender).
 */
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.authContainer} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5', padding: '3rem' }}>
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}><h1 style={{ fontSize: '2rem', fontWeight: 600, color: '#1a1a1a', margin: 0 }}>Milko</h1></div>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '12px', width: '100%', maxWidth: '440px', textAlign: 'center', color: '#666' }}>Loading…</div>
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

