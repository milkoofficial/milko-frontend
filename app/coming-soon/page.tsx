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

      <p className={styles.tagline}>
        "Kya Apke Doodh Me Shampoo Hai?"
      </p>

      <div className={styles.infoSection}>
        <p className={styles.infoText}>
          In 2012, a survey by FSSAI was filed as an affidavit in the Supreme court, in response to a PIL by a group of citizens seeking a report on the adulteration of milk in India.
        </p>
        <p className={styles.highlight}>
          "According to the survey, 68.4 percent of the milk in the country was found to be adulterated and unsafe for consumption."
        </p>
        <p className={styles.infoText}>
          The components of these synthetic milk could prove to be life-threatening for diabetic patients and can even cause cancer and heart problems.
        </p>
        <p className={styles.infoText}>
          According to a recent survey by FSSAI in 2018, 6,432 samples were lifted across the country, in which 68% milk and its product were found to be below standard, while 39% were found to be on compliant, containing fat, solid non-fat, sugar, and maltodextrin. Whereas, 9.9% was declared as completely unsafe for consumption.
        </p>
      </div>

      <h2 className={styles.solutionTitle}>How Milko solves this?</h2>

      <ul className={styles.benefitsList}>
        <li className={styles.benefitItem}>
          <span className={styles.benefitIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.benefitText}>Fresh, home-handled milk delivered daily.</span>
        </li>
        <li className={styles.benefitItem}>
          <span className={styles.benefitIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.benefitText}>Zero adulteration — no water, chemicals, or preservatives.</span>
        </li>
        <li className={styles.benefitItem}>
          <span className={styles.benefitIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.benefitText}>Daily quality checks before delivery.</span>
        </li>
        <li className={styles.benefitItem}>
          <span className={styles.benefitIcon} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className={styles.benefitText}>Priority delivery and assured supply for members.</span>
        </li>
        <li className={styles.benefitItem}>
          <span className={styles.benefitIcon}>💰</span>
          <span className={styles.benefitText}>Adulteration proven? ₹5,100 paid to the customer.</span>
        </li>
      </ul>

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
