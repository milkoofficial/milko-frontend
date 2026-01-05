'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isAdminDomain, getPostLoginRedirect } from '@/lib/utils/domain';
import Link from 'next/link';
import FloatingLabelInput from '@/components/ui/FloatingLabelInput';
import styles from '../auth.module.css';

/**
 * Sign Up Page
 * Only available on customer domain (milko.in), not on admin subdomain
 */
export default function SignUpPage() {
  const router = useRouter();
  const { signup, isAuthenticated, user } = useAuth();
  const isAdmin = isAdminDomain();

  // Redirect admin subdomain to customer domain for signup
  useEffect(() => {
    if (isAdmin) {
      router.push('https://milko.in/auth/signup');
    }
  }, [isAdmin, router]);

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
        By continuing, you agree to our Terms of service & Privacy policy
      </p>
    </div>
  );
}

