'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import styles from './AdminPasswordGate.module.css';

/**
 * Admin Password Gate Component
 * Additional security layer - requires password even if user has admin role
 */
export default function AdminPasswordGate() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { logout } = useAuth();

  // Check if already verified in this session
  useEffect(() => {
    const isVerified = sessionStorage.getItem('adminPanelVerified') === 'true';
    if (isVerified) {
      // Password already verified, allow access
      return;
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    // Get admin panel password from environment variable
    // Default to demo password (will be removed later)
    // IMPORTANT: Set NEXT_PUBLIC_ADMIN_PANEL_PASSWORD in .env.local for production
    const adminPanelPassword = process.env.NEXT_PUBLIC_ADMIN_PANEL_PASSWORD || '2316';
    
    // Verify password (trim whitespace for safety)
    if (password.trim() === adminPanelPassword.trim()) {
      // Store verification in sessionStorage (clears on browser close)
      sessionStorage.setItem('adminPanelVerified', 'true');
      // Reload to show admin panel
      window.location.reload();
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
      setIsVerifying(false);
    }
  };

  const handleReturnToWebsite = () => {
    router.push('/');
  };

  const handleLogout = async () => {
    // Clear password verification on logout
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('adminPanelVerified');
    }
    await logout();
    router.push('/auth/login');
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="adminPassword" className={styles.label}>
              Admin Panel Password
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="adminPassword"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                placeholder="Enter password"
                autoFocus
                disabled={isVerifying}
                required
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={togglePasswordVisibility}
                disabled={isVerifying}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </div>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isVerifying || !password}
          >
            {isVerifying ? 'Verifying...' : 'Access Admin Panel'}
          </button>
        </form>

        <div className={styles.footer}>
          <Link href="/" className={styles.returnLink} onClick={handleReturnToWebsite}>
            Return to website
          </Link>
          <span className={styles.separator}>|</span>
          <button type="button" className={styles.logoutLink} onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
