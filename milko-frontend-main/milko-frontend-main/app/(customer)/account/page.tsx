'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { contentApi } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './account.module.css';
import WalletModal from '@/components/WalletModal';

/**
 * Account menu page (mobile-focused).
 * Shown when logged-in users tap the account icon on mobile.
 * Profile card at top + list of the same options as the header dropdown.
 */
const DEFAULT_APP_STORE_HREF = 'https://play.google.com/store';

export default function AccountPage() {
  const { user, isAuthenticated, logout, loading } = useAuth();
  const router = useRouter();
  const [walletOpen, setWalletOpen] = useState(false);
  const [appDownloadHref, setAppDownloadHref] = useState(
    () => process.env.NEXT_PUBLIC_PLAY_STORE_URL || DEFAULT_APP_STORE_HREF
  );

  useEffect(() => {
    contentApi
      .getByType('app_download')
      .then((c) => {
        const fromAdmin = (c.metadata?.downloadAppUrl || '').toString().trim();
        if (fromAdmin) setAppDownloadHref(fromAdmin);
        else setAppDownloadHref(process.env.NEXT_PUBLIC_PLAY_STORE_URL || DEFAULT_APP_STORE_HREF);
      })
      .catch(() => {
        setAppDownloadHref(process.env.NEXT_PUBLIC_PLAY_STORE_URL || DEFAULT_APP_STORE_HREF);
      });
  }, []);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    router.push('/auth/login');
    return null;
  }

  const isAdmin = user.role === 'admin';
  const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <div className={styles.container}>
      <Link href="/" className={styles.backLink} onClick={(e) => { e.preventDefault(); router.back(); }}>
        <svg className={styles.backIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back
      </Link>

      {/* Profile card */}
      <div className={styles.profileCard}>
        <div className={styles.avatar}>{initial}</div>
        <div className={styles.profileInfo}>
          <h1 className={styles.profileName}>{user.name || 'User'}</h1>
          <p className={styles.profileEmail}>{user.email}</p>
        </div>
      </div>

      {/* Options list (same as header dropdown) */}
      <div className={styles.optionsCard}>
        <Link href="/dashboard" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z"/>
            <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" strokeWidth="1.5"/>
          </svg>
          <span className={styles.optionLabel}>My Account</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <button
          type="button"
          className={styles.optionRow}
          onClick={() => setWalletOpen(true)}
        >
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M21 7H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M19 7V5a2 2 0 0 0-2-2h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M1 11h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className={styles.optionLabel}>Wallet</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <Link href="/orders" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8C21 7.46957 20.7893 6.96086 20.4142 6.58579C20.0391 6.21071 19.5304 6 19 6H5C4.46957 6 3.96086 6.21071 3.58579 6.58579C3.21071 6.96086 3 7.46957 3 8V16C3 16.5304 3.21071 17.0391 3.58579 17.4142C3.96086 17.7893 4.46957 18 5 18H19C19.5304 18 20.0391 17.7893 20.4142 17.4142C20.7893 17.0391 21 16.5304 21 16Z"/>
            <path d="M3 10H21"/>
            <path d="M8 14H8.01"/>
          </svg>
          <span className={styles.optionLabel}>Orders</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <Link href="/subscriptions" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 16L3 5L8.5 10L12 8L15.5 10L21 5L19 16H5Z"/>
            <path d="M3 16H21"/>
          </svg>
          <span className={styles.optionLabel}>Subscriptions</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <Link href="/reviews" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
          <span className={styles.optionLabel}>Reviews</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <a
          href={appDownloadHref}
          className={`${styles.optionRow} ${styles.optionRowAppDownload}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg
            className={`${styles.optionIcon} ${styles.optionIconAppStore}`}
            viewBox="0 0 511.999 511.999"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
          >
            <g>
              <path fill="#2c9fd9" d="M382.369,175.623C322.891,142.356,227.427,88.937,79.355,6.028 C69.372-0.565,57.886-1.429,47.962,1.93l254.05,254.05L382.369,175.623z" />
              <path fill="#2c9fd9" d="M47.962,1.93c-1.86,0.63-3.67,1.39-5.401,2.308C31.602,10.166,23.549,21.573,23.549,36v439.96 c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314L302.012,255.98L47.962,1.93z" />
              <path fill="#2c9fd9" d="M302.012,255.98L47.956,510.035c9.927,3.384,21.413,2.586,31.399-4.103 c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L302.012,255.98z" />
            </g>
            <path fill="#2C9FD9" d="M23.549,255.98v219.98c0,14.427,8.052,25.834,19.012,31.761c1.728,0.917,3.537,1.68,5.395,2.314 L302.012,255.98H23.549z" />
            <path fill="#29CC5E" d="M79.355,6.028C67.5-1.8,53.52-1.577,42.561,4.239l255.595,255.596l84.212-84.212 C322.891,142.356,227.427,88.937,79.355,6.028z" />
            <path fill="#D93F21" d="M298.158,252.126L42.561,507.721c10.96,5.815,24.939,6.151,36.794-1.789 c143.598-80.41,237.986-133.196,298.152-166.746c1.675-0.941,3.316-1.861,4.938-2.772L298.158,252.126z" />
            <path fill="#ffaa00" d="M488.45,255.98c0-12.19-6.151-24.492-18.342-31.314c0,0-22.799-12.721-92.682-51.809l-83.123,83.123 l83.204,83.205c69.116-38.807,92.6-51.892,92.6-51.892C482.299,280.472,488.45,268.17,488.45,255.98z" />
            <path fill="#FFAA00" d="M470.108,287.294c12.191-6.822,18.342-19.124,18.342-31.314H294.303l83.204,83.205 C446.624,300.379,470.108,287.294,470.108,287.294z" />
          </svg>
          <span className={styles.optionLabel}>Download our App</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </a>

        {isAdmin && (
          <Link href="/admin" className={styles.optionRow}>
            <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3H10V10H3V3Z"/>
              <path d="M14 3H21V10H14V3Z"/>
              <path d="M3 14H10V21H3V14Z"/>
              <path d="M14 14H21V21H14V14Z"/>
            </svg>
            <span className={styles.optionLabel}>Panel</span>
            <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        )}

        <Link href="/about" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4M12 8h.01"/>
          </svg>
          <span className={styles.optionLabel}>About Us</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <Link href="/contact" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span className={styles.optionLabel}>Contact Us</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <Link href="/privacy" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          <span className={styles.optionLabel}>Privacy</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <Link href="/terms" className={styles.optionRow}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>
          </svg>
          <span className={styles.optionLabel}>Terms</span>
          <svg className={styles.optionArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        <button type="button" className={`${styles.optionRow} ${styles.optionRowLogout}`} onClick={handleLogout}>
          <svg className={styles.optionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9"/>
            <path d="M16 17L21 12L16 7"/>
            <path d="M21 12H9"/>
          </svg>
          <span className={styles.optionLabel}>Logout</span>
        </button>
      </div>

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
