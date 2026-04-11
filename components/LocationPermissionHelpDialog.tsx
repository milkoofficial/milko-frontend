'use client';

import { createPortal } from 'react-dom';
import styles from './LocationPermissionHelpDialog.module.css';

type Props = {
  open: boolean;
  onClose: () => void;
  onTryAgain: () => void;
};

export default function LocationPermissionHelpDialog({ open, onClose, onTryAgain }: Props) {
  if (typeof document === 'undefined' || !open) return null;

  return createPortal(
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="milko-loc-perm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="milko-loc-perm-title" className={styles.title}>
          Turn on location access
        </h3>
        <p className={styles.body}>
          Location was blocked. Browsers and in-app webviews <strong>do not show the system permission popup again</strong>{' '}
          after you choose Block—allow this site in settings, then tap <strong>Try again</strong>.
        </p>
        <ul className={styles.list}>
          <li>
            <strong>Chrome / Edge (desktop):</strong> lock or site icon in the address bar → Site settings → Location →
            Allow.
          </li>
          <li>
            <strong>Chrome (Android):</strong> lock icon → Permissions → Location → Allow.
          </li>
          <li>
            <strong>Safari (iPhone):</strong> Settings → Privacy &amp; Security → Location Services (or per-site Safari
            settings).
          </li>
        </ul>
        <div className={styles.actions}>
          <button type="button" className={styles.btnPrimary} onClick={onTryAgain}>
            Try again
          </button>
          <button type="button" className={styles.btnSecondary} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
