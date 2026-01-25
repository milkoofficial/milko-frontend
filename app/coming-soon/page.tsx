'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './page.module.css';
import { COMING_SOON_BYPASS_COOKIE } from '@/lib/utils/constants';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((m) => m.DotLottieReact),
  { ssr: false }
);

const BYPASS_MAX_AGE = 86400; // 24 hours
const LOTTIE_SRC =
  process.env.NEXT_PUBLIC_COMING_SOON_LOTTIE || '/animations/coming-soon.lottie';

function setBypassCookie() {
  document.cookie = `${COMING_SOON_BYPASS_COOKIE}=1; path=/; max-age=${BYPASS_MAX_AGE}; samesite=lax`;
}

/**
 * Coming Soon Page
 * Shown to customers when "Coming Soon" mode is on. Admins bypass via login or "access through password".
 * Logged-in admins are redirected to /.
 */
export default function ComingSoonPage() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Logged-in admins can access the site; redirect them off coming-soon
  useEffect(() => {
    if (authLoading) return;
    if (isAdmin) {
      router.replace('/');
    }
  }, [authLoading, isAdmin, router]);

  const handleAccessClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setError('');
    setPassword('');
    setShowModal(true);
  };

  // Don't render this page for admins (they get redirected to /).
  // IMPORTANT: Do NOT block customers while auth is loading, otherwise the page appears blank.
  if (isAdmin) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);

    const adminPanelPassword =
      process.env.NEXT_PUBLIC_ADMIN_PANEL_PASSWORD || '2316';

    if (password.trim() === adminPanelPassword.trim()) {
      setBypassCookie();
      setShowModal(false);
      // Hard redirect so the cookie is definitely included and middleware lets us through
      window.location.href = '/';
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
      setIsVerifying(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <main className={styles.main}>
        <div className={styles.lottieWrap}>
          <DotLottieReact
            src={LOTTIE_SRC}
            loop
            autoplay
            renderConfig={{ autoResize: true }}
          />
        </div>
        <h1 className={styles.title}>We are coming</h1>
        <p className={styles.subtitle}>
        We’re working behind the scenes to bring you
        100% pure, chemical-free milk and dairy products.
        </p>
        <a
          href="#"
          onClick={handleAccessClick}
          className={styles.accessLink}
        >
          access through password
        </a>
      </main>

      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className={styles.modalTitle}>Access through password</h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className={styles.input}
                disabled={isVerifying}
                autoFocus
              />
              {error && <p className={styles.error}>{error}</p>}
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowModal(false)}
                  disabled={isVerifying}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isVerifying || !password}
                >
                  {isVerifying ? 'Verifying…' : 'Access'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
