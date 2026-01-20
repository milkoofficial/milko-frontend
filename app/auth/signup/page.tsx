'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminDomain, getPostLoginRedirect } from '@/lib/utils/domain';
import Link from 'next/link';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import Logo from '@/components/Logo';
import styles from '../auth.module.css';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.335z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  );
}

/**
 * Sign Up Page
 * Only available on customer domain (milko.in), not on admin subdomain
 */
export default function SignUpPage() {
  const router = useRouter();
  const { signup, loginWithGoogle, isAuthenticated, user } = useAuth();
  const isAdmin = isAdminDomain();

  // Redirect admin subdomain to customer domain for signup
  // BUT: In localhost, allow signup on same domain
  useEffect(() => {
    if (isAdmin && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
      window.location.href = 'https://milko.in/auth/signup';
    }
  }, [isAdmin]);

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

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, password: false, confirmPassword: false });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setTouched({ name: true, email: true, password: true, confirmPassword: true });

    // Validate required fields
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await signup(name, email, password);
      const redirectPath = getPostLoginRedirect(response.user.role);
      
      if (redirectPath.startsWith('http')) {
        window.location.href = redirectPath;
      } else {
        router.push(redirectPath);
      }
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.');
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
      padding: '1rem'
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ margin: 0 }}>
          <Logo textClassName={styles.authLogoText} imageClassName={styles.authLogoImg} />
        </h1>
      </div>

      {/* Signup Card */}
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
          Create your account
        </h2>
        
        {/* Subtitle */}
        <p style={{ 
          fontSize: '0.85rem',
          color: '#666',
          marginBottom: '2rem',
          lineHeight: '1.5',
          textAlign: 'center'
        }}>
          Welcome! Please enter your details to get started.
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
          {/* Name Field */}
          <FloatingLabelInput
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setTouched(prev => ({ ...prev, name: true }))}
            label="Name"
            required
            hasError={touched.name && !name}
          />

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

          {/* Confirm Password Field */}
          <div style={{ marginBottom: '1.5rem' }}>
            <FloatingLabelInput
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))}
              label="Confirm Password"
              required
              showPasswordToggle
              showPassword={showConfirmPassword}
              onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
              hasError={touched.confirmPassword && !confirmPassword}
            />
          </div>

          {/* Sign Up Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? '#93c5fd' : '#2563eb',
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
            {loading ? 'Creating account...' : 'Sign up'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', margin: '1.25rem 0', gap: '1rem' }}>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
            <span style={{ fontSize: '1rem', color: '#999' }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
          </div>

          {/* Google Sign Up */}
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

        {/* Login Link */}
        <p style={{ 
          textAlign: 'center', 
          color: '#666',
          fontSize: '0.9rem',
          margin: 0
        }}>
          Already have an account?{' '}
          <Link 
            href="/auth/login" 
            style={{ 
              color: '#0070f3',
              textDecoration: 'none',
              fontWeight: 500
            }}
          >
            Log in
          </Link>
        </p>
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
        By continuing, you agree to our{' '}
        <Link href="/terms" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 500 }}>Terms of service</Link>
        {' & '}
        <Link href="/privacy" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 500 }}>Privacy policy</Link>
      </p>
    </div>
  );
}

