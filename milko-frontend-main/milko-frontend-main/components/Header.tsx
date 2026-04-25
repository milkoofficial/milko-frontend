'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/contexts/ToastContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Header.module.css';
import { User, Product } from '@/types';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import { readScopedPincode, writeScopedPincode, scopedPincodeStatusKey } from '@/lib/utils/userScopedStorage';
import { contentApi, productsApi, walletApi } from '@/lib/api';
import ProductDetailsModal from './ProductDetailsModal';
import Logo from './Logo';
import { getCardDisplayPrice, getProductDisplayUnitLabel } from '@/lib/utils/productCardPricing';
import { getPrimaryProductImageUrl } from '@/lib/utils/productImages';

/**
 * User Dropdown Component
 * Shows "Hi, [name]" with dropdown menu
 */
function UserDropdown({ user, logout, isAdmin, isMobile = false }: { user: User | null; logout: () => void; isAdmin: boolean; isMobile?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { showToast } = useToast();
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletTx, setWalletTx] = useState<Array<{ id: string; type: 'credit' | 'debit'; amount: number; source: string; createdAt?: string | null }>>([]);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletAddAmountOpen, setWalletAddAmountOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setWalletLoading(true);
    walletApi
      .getSummary()
      .then((w) => {
        if (cancelled) return;
        setWalletBalance(w.balance);
        setWalletTx(w.transactions || []);
      })
      .catch(() => {
        if (cancelled) return;
        setWalletBalance(null);
        setWalletTx([]);
      })
      .finally(() => {
        if (cancelled) return;
        setWalletLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!walletModalOpen) return;
    let cancelled = false;
    setWalletLoading(true);
    walletApi
      .getSummary()
      .then((w) => {
        if (cancelled) return;
        setWalletBalance(w.balance);
        setWalletTx(w.transactions || []);
      })
      .catch(() => {
        if (cancelled) return;
        setWalletBalance(null);
        setWalletTx([]);
      })
      .finally(() => {
        if (cancelled) return;
        setWalletLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [walletModalOpen]);

  useEffect(() => {
    if (!walletModalOpen) {
      setWalletAddAmountOpen(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (walletAddAmountOpen) {
        setWalletAddAmountOpen(false);
      } else {
        setWalletModalOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [walletModalOpen, walletAddAmountOpen]);

  const loadRazorpayScript = (): Promise<void> => {
    if (typeof window !== 'undefined' && (window as unknown as { Razorpay?: unknown }).Razorpay) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Failed to load Razorpay'));
      document.head.appendChild(s);
    });
  };

  const handleAddMoney = async () => {
    const amt = Math.round(Number(walletAmount) * 100) / 100;
    if (!Number.isFinite(amt) || amt <= 0) {
      showToast('Enter a valid amount', 'error');
      return;
    }
    try {
      const topup = await walletApi.createTopupOrder(amt);

      // Manual top-up mode (dev/local): backend credited wallet without Razorpay.
      if ('manual' in topup && topup.manual) {
        setWalletAmount('');
        setWalletAddAmountOpen(false);
        setWalletBalance(topup.balance);
        const refreshed = await walletApi.getSummary();
        setWalletTx(refreshed.transactions || []);
        showToast('Wallet topped up', 'success');
        return;
      }

      if (!('razorpayOrderId' in topup)) return;
      const order = topup;
      await loadRazorpayScript();
      const Razorpay = (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay;
      const rzp = new Razorpay({
        key: order.key,
        order_id: order.razorpayOrderId,
        currency: order.currency || 'INR',
        name: 'Milko',
        description: 'Add money to wallet',
        handler: async function (resp: { razorpay_payment_id: string; razorpay_order_id: string }) {
          try {
            const v = await walletApi.verifyTopup({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
            });
            setWalletBalance(v.balance);
            setWalletAmount('');
            setWalletAddAmountOpen(false);
            const refreshed = await walletApi.getSummary();
            setWalletTx(refreshed.transactions || []);
            showToast('Wallet topped up', 'success');
          } catch (e) {
            showToast((e as { message?: string })?.message || 'Wallet top-up failed', 'error');
          }
        },
      });
      rzp.open();
    } catch (e) {
      showToast((e as { message?: string })?.message || 'Failed to start top-up', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    router.push('/');
  };

  const formatWalletAmount = (amount: number) =>
    amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const getWalletTxPurpose = (tx: { type: 'credit' | 'debit'; source: string }) => {
    const source = (tx.source || '').toLowerCase();
    if (tx.type === 'credit') {
      return 'Money added';
    }
    if (source.includes('subscription')) {
      return 'Subscription bought';
    }
    if (source.includes('purchase')) {
      return 'Item bought';
    }
    if (source.includes('order') || source.includes('product') || source.includes('milk')) {
      return 'Order bought';
    }
    if (source.trim()) {
      return `${tx.source} bought`;
    }
    return 'Purchase made';
  };

  const formatWalletTxDate = (createdAt?: string | null) => {
    if (!createdAt) return '--.--.----';
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '--.--.----';
    return date.toLocaleDateString('en-GB').replace(/\//g, '.');
  };

  // Mobile: redirect to /account page instead of showing dropdown
  if (isMobile) {
    return (
      <Link href="/account" className={styles.iconButton} aria-label="Account">
        <svg className={styles.buttonIcon} viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
          <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
          <g id="SVGRepo_iconCarrier">
            <path fillRule="evenodd" clipRule="evenodd" d="M8.25 9C8.25 6.92893 9.92893 5.25 12 5.25C14.0711 5.25 15.75 6.92893 15.75 9C15.75 11.0711 14.0711 12.75 12 12.75C9.92893 12.75 8.25 11.0711 8.25 9ZM12 6.75C10.7574 6.75 9.75 7.75736 9.75 9C9.75 10.2426 10.7574 11.25 12 11.25C13.2426 11.25 14.25 10.2426 14.25 9C14.25 7.75736 13.2426 6.75 12 6.75Z" fill="currentColor"></path>
            <path fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 14.5456 3.77827 16.851 5.4421 18.5235C5.6225 17.5504 5.97694 16.6329 6.68837 15.8951C7.75252 14.7915 9.45416 14.25 12 14.25C14.5457 14.25 16.2474 14.7915 17.3115 15.8951C18.023 16.6329 18.3774 17.5505 18.5578 18.5236C20.2217 16.8511 21.25 14.5456 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM17.1937 19.6554C17.0918 18.4435 16.8286 17.5553 16.2318 16.9363C15.5823 16.2628 14.3789 15.75 12 15.75C9.62099 15.75 8.41761 16.2628 7.76815 16.9363C7.17127 17.5553 6.90811 18.4434 6.80622 19.6553C8.28684 20.6618 10.0747 21.25 12 21.25C13.9252 21.25 15.7131 20.6618 17.1937 19.6554Z" fill="currentColor"></path>
          </g>
        </svg>
        <span className={styles.iconButtonText}>Account</span>
      </Link>
    );
  }

  return (
    <div className={styles.userDropdown} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.userButton}
      >
        <svg className={styles.userButtonIcon} viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg">
          <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
          <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
          <g id="SVGRepo_iconCarrier">
            <path fillRule="evenodd" clipRule="evenodd" d="M8.25 9C8.25 6.92893 9.92893 5.25 12 5.25C14.0711 5.25 15.75 6.92893 15.75 9C15.75 11.0711 14.0711 12.75 12 12.75C9.92893 12.75 8.25 11.0711 8.25 9ZM12 6.75C10.7574 6.75 9.75 7.75736 9.75 9C9.75 10.2426 10.7574 11.25 12 11.25C13.2426 11.25 14.25 10.2426 14.25 9C14.25 7.75736 13.2426 6.75 12 6.75Z" fill="currentColor"></path>
            <path fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 14.5456 3.77827 16.851 5.4421 18.5235C5.6225 17.5504 5.97694 16.6329 6.68837 15.8951C7.75252 14.7915 9.45416 14.25 12 14.25C14.5457 14.25 16.2474 14.7915 17.3115 15.8951C18.023 16.6329 18.3774 17.5505 18.5578 18.5236C20.2217 16.8511 21.25 14.5456 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM17.1937 19.6554C17.0918 18.4435 16.8286 17.5553 16.2318 16.9363C15.5823 16.2628 14.3789 15.75 12 15.75C9.62099 15.75 8.41761 16.2628 7.76815 16.9363C7.17127 17.5553 6.90811 18.4434 6.80622 19.6553C8.28684 20.6618 10.0747 21.25 12 21.25C13.9252 21.25 15.7131 20.6618 17.1937 19.6554Z" fill="currentColor"></path>
          </g>
        </svg>
        <span>Hi, {user?.name || 'User'}</span>
        <svg className={`${styles.dropdownArrow} ${isOpen ? styles.dropdownArrowOpen : ''}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div className={styles.dropdownMenu}>
          <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            My Account
          </Link>
          <button
            type="button"
            className={styles.dropdownItem}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(false);
              setWalletModalOpen(true);
            }}
          >
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M21 7H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M19 7V5a2 2 0 0 0-2-2h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M1 11h22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className={styles.dropdownItemLabel}>Wallet</span>
            <span className={styles.dropdownItemTrail}>
              {walletLoading ? '…' : walletBalance !== null ? `₹${formatWalletAmount(walletBalance)}` : '—'}
            </span>
          </button>
          <Link href="/orders" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 16V8C21 7.46957 20.7893 6.96086 20.4142 6.58579C20.0391 6.21071 19.5304 6 19 6H5C4.46957 6 3.96086 6.21071 3.58579 6.58579C3.21071 6.96086 3 7.46957 3 8V16C3 16.5304 3.21071 17.0391 3.58579 17.4142C3.96086 17.7893 4.46957 18 5 18H19C19.5304 18 20.0391 17.7893 20.4142 17.4142C20.7893 17.0391 21 16.5304 21 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 14H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Orders
          </Link>
          <Link href="/subscriptions" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 16L3 5L8.5 10L12 8L15.5 10L21 5L19 16H5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M3 16H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Subscriptions
          </Link>
          <Link href="/reviews" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Reviews
          </Link>
          {isAdmin && (
            <Link href="/admin" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
              <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3H10V10H3V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 3H21V10H14V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 14H10V21H3V14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M14 14H21V21H14V14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Panel
            </Link>
          )}
          <button className={styles.dropdownItem} onClick={handleLogout}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Logout
          </button>
        </div>
      )}
      {walletModalOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={styles.walletModalOverlay}
            role="presentation"
            onClick={() => {
              setWalletModalOpen(false);
              setWalletAddAmountOpen(false);
            }}
          >
            <div
              className={styles.walletModalContent}
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.walletModalHeader}>
                <h2 id="wallet-modal-title" className={styles.walletModalTitle}>
                  Wallet
                </h2>
                <button
                  type="button"
                  className={styles.walletModalClose}
                  onClick={() => {
                    setWalletModalOpen(false);
                    setWalletAddAmountOpen(false);
                  }}
                  aria-label="Close wallet"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <div className={styles.walletModalBalanceBlock}>
                <div className={styles.walletModalBalanceLeft}>
                  <span className={styles.walletModalBalanceLabel}>Balance</span>
                  <span className={styles.walletModalBalanceValue}>
                    {walletLoading ? 'Loading…' : walletBalance !== null ? `₹${formatWalletAmount(walletBalance)}` : '—'}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.walletModalBalanceAddBtn}
                  onClick={() => {
                    setWalletAmount('');
                    setWalletAddAmountOpen(true);
                  }}
                >
                  <svg
                    className={styles.walletModalBalanceAddBtnIcon}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>Add money</span>
                </button>
              </div>
              {walletAddAmountOpen && (
                <div
                  className={styles.walletNestedOverlay}
                  role="presentation"
                  onClick={() => setWalletAddAmountOpen(false)}
                >
                  <div
                    className={styles.walletNestedContent}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wallet-add-amount-title"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 id="wallet-add-amount-title" className={styles.walletNestedTitle}>
                      How much do you want to add?
                    </h3>
                    <label className={styles.walletNestedLabel} htmlFor="wallet-add-amount-input">
                      Amount (₹)
                    </label>
                    <input
                      id="wallet-add-amount-input"
                      className={styles.walletNestedInput}
                      inputMode="decimal"
                      placeholder="e.g. 500"
                      value={walletAmount}
                      onChange={(e) => setWalletAmount(e.target.value)}
                      autoFocus
                    />
                    <div className={styles.walletNestedActions}>
                      <button
                        type="button"
                        className={styles.walletNestedCancel}
                        onClick={() => setWalletAddAmountOpen(false)}
                      >
                        Cancel
                      </button>
                      <button type="button" className={styles.walletNestedSubmit} onClick={handleAddMoney}>
                        Continue
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className={styles.walletModalSectionLabel}>Transaction history</div>
              <div className={styles.walletModalTxList}>
                {walletLoading ? (
                  <p className={styles.walletModalEmpty}>Loading…</p>
                ) : walletTx.length === 0 ? (
                  <p className={styles.walletModalEmpty}>
                    <span
                      className={styles.walletModalEmptyIcon}
                      aria-hidden="true"
                      dangerouslySetInnerHTML={{
                        __html: `<svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <path fill-rule="evenodd" clip-rule="evenodd" d="M232.805 146.703C234.603 144.355 235.653 141.606 236.117 138.728C236.348 137.314 236.317 135.86 236.194 134.44C236.084 133.169 235.708 131.935 235.385 130.706C235.281 130.303 235.156 129.932 234.982 129.593C235.212 129.303 235.4 128.982 235.537 128.638C235.886 127.76 235.956 126.52 235.463 125.675C234.895 124.696 234.322 123.73 233.508 122.93C232.665 122.105 231.787 121.3 230.847 120.578C229.291 119.389 227.58 118.468 225.783 117.674C224.552 117.131 223.218 116.82 221.908 116.519C220.595 116.219 219.206 116.294 217.874 116.361C216.352 116.438 214.853 116.943 213.41 117.387C208.61 118.862 205.189 123.017 203.288 127.438C202.53 129.201 202.154 131.141 201.847 133.022C201.703 133.912 201.553 134.817 201.491 135.719C201.376 137.345 201.294 138.955 201.363 140.59C201.419 141.902 201.562 143.176 201.846 144.461C202.174 145.957 202.723 147.425 203.377 148.808C203.935 149.992 204.671 151.104 205.425 152.172C206.128 153.17 207.069 154.013 208.014 154.783C209.085 155.654 210.586 156.121 211.936 156.362C213.519 156.643 215.093 156.604 216.693 156.415C218.27 156.233 219.832 155.699 221.342 155.232C222.352 154.916 223.346 154.569 224.322 154.156C224.739 153.979 225.146 153.78 225.54 153.565C228.483 151.951 230.803 149.319 232.805 146.703Z" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path fill-rule="evenodd" clip-rule="evenodd" d="M169.749 119.35C168.825 119.971 168.109 120.717 167.351 121.527C166.45 122.492 165.873 123.785 165.326 124.959C164.845 125.988 164.534 127.085 164.277 128.195C162.438 128.005 160.603 129.069 159.939 130.831C158.879 133.666 158.911 136.615 159.437 139.552C159.678 140.893 160.124 142.212 160.535 143.51C160.888 144.626 161.265 145.727 161.735 146.802C162.086 147.609 162.592 148.376 163.085 149.104C163.563 149.815 164.081 150.465 164.684 151.083C165.38 151.796 166.171 152.466 166.973 153.07C167.638 153.568 168.424 153.923 169.16 154.302C168.831 154.134 168.504 153.964 168.174 153.796C169.14 154.291 170.071 154.748 171.093 155.106C172.226 155.503 173.411 155.73 174.583 155.978C176.75 156.436 179.063 156.301 181.215 155.841C183.48 155.357 185.576 154.413 187.499 153.166C191.327 150.684 194.19 146.793 195.457 142.475C196.099 140.289 196.25 138.119 196.001 135.861C195.893 134.872 195.754 133.894 195.558 132.917C195.094 130.63 194.399 128.337 193.415 126.215C192.986 125.292 192.436 124.418 191.869 123.572C191.539 123.08 191.185 122.62 190.802 122.162C190.317 121.591 189.707 121.119 189.152 120.618C188.118 119.685 186.747 119.068 185.489 118.496C184.904 118.231 184.28 118.048 183.673 117.841C181.887 117.23 179.991 116.912 178.104 116.912C175.153 116.911 172.223 117.69 169.749 119.35Z" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M235.464 179.408C235.536 182.688 235.585 186.889 235.643 190.169C235.672 191.806 235.74 193.438 235.809 195.068C235.871 196.568 235.966 198.064 236.019 199.567C236.059 200.706 236.094 201.844 236.125 202.983C236.124 202.967 236.124 202.952 236.123 202.936C236.163 205.111 236.187 207.289 236.248 209.463C236.309 211.609 236.385 213.754 236.443 215.903C236.476 217.646 236.499 219.389 236.533 221.132C236.551 222.06 236.569 222.988 236.533 221.132C236.551 222.06 236.569 222.988 236.587 223.916C236.607 224.895 236.634 225.877 236.615 226.858" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M219.261 175.936C219.333 180.416 219.382 186.154 219.44 190.634C219.469 192.869 219.537 195.099 219.606 197.325C219.668 199.375 219.763 201.418 219.816 203.47C219.855 205.026 219.891 206.58 219.921 208.136C219.921 208.115 219.921 208.093 219.92 208.072C219.96 211.043 219.984 214.018 220.045 216.986C220.106 219.918 220.182 222.848 220.24 225.782C220.273 228.164 220.296 230.544 220.33 232.925C220.348 234.192 220.366 235.46 220.384 236.727C220.404 238.065 220.431 239.405 220.412 240.746" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M162.552 179.408C162.671 183.248 162.752 188.166 162.848 192.006C162.895 193.922 163.008 195.833 163.122 197.741C163.224 199.498 163.37 212.05 163.47 214.594C163.571 217.107 163.319 219.618 163.414 222.133C163.47 224.175 163.508 226.215 163.563 228.256C163.593 229.342 163.624 230.428 163.653 231.514C163.686 232.661 163.73 233.81 163.698 234.96" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M200.754 172.464C200.723 176.824 200.762 181.176 200.909 185.533C201.053 189.733 201.247 193.928 201.486 198.122C201.629 200.68 201.784 203.235 201.939 205.793C201.931 205.63 201.923 205.467 201.917 205.306C202.006 207.189 202.114 209.069 202.169 210.954C202.233 213.14 202.291 215.326 202.33 217.512C202.402 221.466 202.446 225.423 202.624 229.374C202.748 232.184 202.911 234.985 203.15 237.785C203.336 240.01 203.467 242.234 203.585 244.464C203.657 246.542 203.729 248.621 203.77 250.703C203.792 251.9 203.818 253.095 203.84 254.294C203.848 254.783 203.856 255.272 203.867 255.762C203.87 256.025 203.879 256.288 203.884 256.551C203.889 256.865 203.916 257.188 203.906 257.505C203.858 257.64 203.827 257.785 203.815 257.947C203.776 258.42 203.923 258.897 204.216 259.263" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path opacity="0.503384" d="M182.227 174.778C182.355 178.762 182.251 187.946 182.354 191.936C182.351 191.789 182.348 191.646 182.346 191.501C182.424 195.324 182.497 199.147 182.564 202.972C182.625 206.484 182.657 209.999 182.69 213.513C182.704 215.028 182.711 216.545 182.722 218.061C182.732 219.53 182.76 221 182.781 222.469C182.8 223.971 182.846 225.473 182.88 226.976C182.908 228.228 182.941 229.478 182.972 230.73C183.019 232.951 183.059 235.172 183.098 237.393C183.14 239.711 183.218 242.021 183.278 244.336C183.278 244.323 183.277 244.309 183.277 244.296C183.296 245.214 183.314 246.131 183.33 247.05L183.356 248.558C183.365 249.04 183.372 249.523 183.384 250.005" stroke="#000000" stroke-opacity="0.9" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M107.972 355.322C102.224 294.943 121.961 259.451 167.181 248.848" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M238.936 247.69C274.427 247.69 292.173 283.567 292.173 355.322" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M168.339 250.005C172.192 264.219 183.708 282.736 202.888 305.557C220.283 281.301 230.756 262.784 234.307 250.005" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M203.059 304.399L204.216 342.591" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M134.776 304.978H172.968" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M251.387 204.869C252.167 204.187 252.747 203.432 253.267 202.553C253.486 202.178 253.706 201.804 253.928 201.432C254.419 200.6 254.942 199.784 255.486 198.986C256.574 197.384 257.884 195.944 258.916 194.307C260.062 192.493 260.916 190.487 261.817 188.549C262.639 186.778 263.51 185.033 264.34 183.266C265.954 179.829 267.572 176.402 268.925 172.855C269.586 171.117 270.025 169.285 270.451 167.477C270.955 165.338 271.452 163.193 271.841 161.028C272.548 157.092 273.136 153.13 273.446 149.142 273.741 145.305 273.654 141.43 273.601 137.588C273.548 133.481 283.251 128.921 283 124.822C282.786 121.325 272.437 118.307 271.867 114.85C271.291 111.382 270.785 107.905 270.039 104.466C269.63 102.582 269.183 100.707 268.741 98.8294C268.332 97.0788 267.969 95.3201 267.545 93.5726C267.048 91.5263 266.519 89.4659 265.767 87.4925C265.564 86.959 265.353 86.4314 265.135 85.9076C264.835 85.3206 264.539 84.7329 264.247 84.1429C263.667 82.9757 263.11 81.7995 262.568 80.6166C261.857 79.3564 261.088 78.1245 260.308 76.9104C259.338 75.3924 258.352 73.8797 257.317 72.4055C255.203 69.3896 253.004 66.4175 250.478 63.7271C248.978 62.1281 247.366 60.5462 245.545 59.3009C243.901 58.1753 242.229 57.0979 240.553 56.0213C238.609 54.7708 236.682 53.5344 234.614 52.489C233.766 52.0595 232.921 51.6679 232.05 51.2905C231.048 50.861 229.974 50.5475 228.942 50.196C225.141 48.9106 221.286 47.8629 217.371 46.9862C213.216 46.0544 208.97 45.619 204.757 45.0098C201.178 44.4904 197.593 44 193.991 44C192.35 44 190.704 44.1011 189.058 44.3477C187.023 44.6524 185.002 44.9949 182.993 45.4593C181.114 45.8977 179.256 46.4259 177.4 46.9542C175.607 47.4654 173.803 47.9328 172.019 48.4841C169.993 49.1105 168.022 49.8364 166.078 50.6812C164.367 51.4242 162.742 52.321 161.136 53.261C160.101 53.865 154.153 57.2686 143.849 70.0316C133.546 82.7945 129.271 111.662 129.075 113.428C128.655 117.222 128.18 121.008 127.999 124.822C127.818 128.649 116.941 133.759 117 137.588C117.027 139.323 127.88 139.778 127.946 141.509C128.026 143.674 128.216 145.822 128.462 147.976C128.871 151.586 129.254 155.208 129.9 158.787C130.592 162.623 131.274 166.466 132.187 170.258C132.609 172.021 133.089 173.772 133.546 175.53C133.99 177.24 134.412 178.959 134.907 180.656C135.464 182.567 136.04 184.473 136.601 186.385C137.203 188.431 137.787 190.486 138.532 192.484C138.985 193.696 139.587 194.83 140.228 195.956C140.916 197.173 141.643 198.356 142.399 199.531C143.239 200.869 144.048 202.227 145.072 203.439" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M154.451 130.819C154.125 130.805 153.8 130.8 153.476 130.8C151.667 130.8 149.883 130.987 148.079 131.183C146.838 131.316 145.596 131.417 144.352 131.535C142.029 131.761 139.736 132.178 137.422 132.462C136.446 132.581 135.471 132.684 134.507 132.877C133.318 133.114 132.152 133.544 131.016 133.952C130.095 134.285 129.187 134.658 128.278 135.02C127.303 135.407 126.33 135.911 125.518 136.586" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M275.708 129.33C275.169 128.625 274.629 128.05 273.813 127.654C273.098 127.31 272.326 127.088 271.534 127.006L271.488 127.001C270.534 126.907 269.563 126.899 268.605 126.855C267.27 126.797 265.938 126.845 264.604 126.912C263.101 126.988 261.603 127.166 260.101 127.266C258.599 127.368 257.092 127.374 255.588 127.415C254.31 127.453 253.03 127.506 251.75 127.501C250.266 127.495 248.785 127.477 247.301 127.55C245.81 127.621 244.323 127.754 242.831 127.811C241.443 127.864 240.069 128.006 238.689 128.141" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> <path d="M193.839 133.742C193.113 134.822 202.609 134.066 201.859 133.114" stroke="#000000" stroke-opacity="0.9" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"></path> </g></svg>`,
                      }}
                    />
                    No transactions yet
                  </p>
                ) : (
                  walletTx.map((t) => (
                    <div key={t.id} className={styles.walletModalTxRow}>
                      <div className={styles.walletModalTxLeft}>
                        <span
                          className={`${styles.walletModalTxIcon} ${t.type === 'credit' ? styles.walletModalTxIconCredit : styles.walletModalTxIconDebit
                            }`}
                          aria-hidden="true"
                        >
                          {t.type === 'credit' ? '↓' : '↑'}
                        </span>
                        <div className={styles.walletModalTxMeta}>
                          <span className={styles.walletModalTxTitle}>{getWalletTxPurpose(t)}</span>
                          <span className={styles.walletModalTxSub}>Txn ID: {t.id}</span>
                        </div>
                      </div>
                      <div className={styles.walletModalTxRight}>
                        <span
                          className={`${styles.walletModalTxAmount} ${t.type === 'credit' ? styles.walletModalTxAmountCredit : styles.walletModalTxAmountDebit
                            }`}
                        >
                          {t.type === 'credit' ? '+' : '-'} ₹{formatWalletAmount(t.amount)}
                        </span>
                        <span className={styles.walletModalTxDate}>{formatWalletTxDate(t.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

/**
 * Header Component
 * Contains logo, search bar, membership button, and login button
 */
export default function Header() {
  const { isAuthenticated, user, logout, isAdmin } = useAuth();
  const { itemCount, addItem } = useCart();
  const { showToast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allProducts, setAllProducts] = useState<Product[] | null>(null);
  const [isSearchProductsLoading, setIsSearchProductsLoading] = useState(false);
  const [isSearchOverlayOpen, setIsSearchOverlayOpen] = useState(false);
  const [isSearchOverlayClosing, setIsSearchOverlayClosing] = useState(false);
  const searchOverlayInputRef = useRef<HTMLInputElement>(null);
  const searchOverlayCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [isCallMenuOpen, setIsCallMenuOpen] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const callMenuRef = useRef<HTMLDivElement>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [pincode, setPincode] = useState(['', '', '', '', '', '']);
  const [deliveryStatus, setDeliveryStatus] = useState<'checking' | 'available' | 'unavailable' | null>(null);
  const [savedPincode, setSavedPincode] = useState<string | null>(null);
  const [savedDeliveryStatus, setSavedDeliveryStatus] = useState<'available' | 'unavailable' | null>(null);
  const [serviceablePincodes, setServiceablePincodes] = useState<Array<{ pincode: string; deliveryTime?: string }> | null>(null);
  const pincodeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const pinUserId = user?.id ?? null;

  // Load saved pincode for the current account (guest vs logged-in)
  useEffect(() => {
    const saved = readScopedPincode(pinUserId);
    setSavedPincode(saved.length === 6 ? saved : null);
  }, [pinUserId]);

  // Load serviceable pincode(s) and delivery time from admin-configured site content
  useEffect(() => {
    (async () => {
      try {
        const cfg = await contentApi.getByType('pincodes');
        const meta = (cfg?.metadata || {}) as any;
        let list: Array<{ pincode: string; deliveryTime?: string }> = [];
        if (Array.isArray(meta.serviceablePincodes)) {
          list = meta.serviceablePincodes.map((el: any) =>
            typeof el === 'string'
              ? { pincode: el.trim(), deliveryTime: '1h' }
              : { pincode: (el.pincode || el).toString().trim(), deliveryTime: (el.deliveryTime || '1h').toString().trim() || '1h' }
          ).filter((x: { pincode: string }) => x.pincode.length === 6);
        } else if (typeof meta.serviceablePincode === 'string' && meta.serviceablePincode.trim()) {
          list = [{ pincode: meta.serviceablePincode.trim(), deliveryTime: '1h' }];
        }
        setServiceablePincodes(list.length > 0 ? list : null);
      } catch {
        setServiceablePincodes(null);
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;

    contentApi
      .getByType('contact')
      .then((data) => {
        if (cancelled) return;
        setContactPhone(String(data?.metadata?.phone || '').trim());
      })
      .catch(() => {
        if (!cancelled) setContactPhone('');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isCallMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (callMenuRef.current && event.target instanceof Node && !callMenuRef.current.contains(event.target)) {
        setIsCallMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsCallMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isCallMenuOpen]);

  const isDeliverable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (cleaned.length !== 6) return false;
    if (!serviceablePincodes || serviceablePincodes.length === 0) return true;
    return serviceablePincodes.some((e) => (typeof e === 'string' ? e : e.pincode) === cleaned);
  };

  const getDeliveryTimeFor = (pin: string): string => {
    if (!serviceablePincodes || serviceablePincodes.length === 0) return '1h';
    const el = serviceablePincodes.find((e) => (typeof e === 'string' ? e : e.pincode) === (pin || '').trim());
    return (el && typeof el === 'object' && (el.deliveryTime || '1h')) || '1h';
  };

  const formatDeliveryTimeDisplay = (t: string): string => {
    const s = (t || '1h').trim();
    if (/^\d+h$/.test(s)) return s.replace(/h$/, 'hr'); // 1h->1hr, 2h->2hr
    return s;
  };

  const contactPhoneDigits = contactPhone.replace(/\D/g, '');
  const hasContactPhone = contactPhoneDigits.length > 0;
  const telHref = hasContactPhone ? `tel:${contactPhone}` : '#';
  const whatsappHref = hasContactPhone ? `https://wa.me/${contactPhoneDigits}` : '#';
  const contactPhoneLabel = contactPhone || 'Not available';

  // If we have a saved pincode, compute saved status based on current config
  useEffect(() => {
    if (!savedPincode || savedPincode.length !== 6) return;
    const ok = isDeliverable(savedPincode);
    setSavedDeliveryStatus(ok ? 'available' : 'unavailable');
    localStorage.setItem(scopedPincodeStatusKey(pinUserId), ok ? 'available' : 'unavailable');
  }, [savedPincode, serviceablePincodes, pinUserId]);

  // Focus first pincode input when modal opens
  useEffect(() => {
    if (isAddressModalOpen) {
      // Reset pincode and delivery status when modal opens
      setPincode(['', '', '', '', '', '']);
      setDeliveryStatus(null);
      // Focus first input after a short delay to ensure DOM is ready
      setTimeout(() => {
        pincodeInputRefs.current[0]?.focus();
      }, 100);
    }
  }, [isAddressModalOpen]);

  // Allow other pages/components to open the header pincode modal
  useEffect(() => {
    const onOpen = () => setIsAddressModalOpen(true);
    window.addEventListener('milko:open-pincode-modal', onOpen as EventListener);
    return () => window.removeEventListener('milko:open-pincode-modal', onOpen as EventListener);
  }, []);

  // Check pincode delivery availability
  const checkPincodeDelivery = async () => {
    const fullPincode = pincode.join('');
    if (fullPincode.length !== 6) return;

    setDeliveryStatus('checking');

    setTimeout(() => {
      const isAvailable = isDeliverable(fullPincode);
      setDeliveryStatus(isAvailable ? 'available' : 'unavailable');
    }, 800); // Simulate network delay
  };

  // Handle final done action
  const handleDone = () => {
    const fullPincode = pincode.join('');
    if (deliveryStatus === 'available') {
      // Save pincode and status to localStorage and state
      writeScopedPincode(pinUserId, fullPincode, 'available');
      setSavedPincode(fullPincode);
      setSavedDeliveryStatus('available');
      window.dispatchEvent(
        new CustomEvent('milko:pincode-updated', {
          detail: { pincode: fullPincode, status: 'available' },
        })
      );
      setIsAddressModalOpen(false);
    } else if (deliveryStatus === 'unavailable') {
      // Save unavailable status
      writeScopedPincode(pinUserId, fullPincode, 'unavailable');
      setSavedPincode(fullPincode);
      setSavedDeliveryStatus('unavailable');
      window.dispatchEvent(
        new CustomEvent('milko:pincode-updated', {
          detail: { pincode: fullPincode, status: 'unavailable' },
        })
      );
      // Close the modal when pincode is unavailable
      setIsAddressModalOpen(false);
    }
  };
  const headerRef = useRef<HTMLElement | null>(null);
  const cartButtonMobileRef = useRef<HTMLElement | null>(null);
  const cartButtonDesktopRef = useRef<HTMLElement | null>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const hasScrolledToMembershipRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 767);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Store cart icon refs for animation
  useEffect(() => {
    const updateRefs = () => {
      cartIconRefStore.setMobile(cartButtonMobileRef.current);
      cartIconRefStore.setDesktop(cartButtonDesktopRef.current);
    };

    updateRefs();
    // Update refs after a short delay to ensure DOM is ready
    const timeout = setTimeout(updateRefs, 100);
    return () => clearTimeout(timeout);
  }, [itemCount]); // Re-run when cart count changes

  // Check if we're on an auth page or admin page
  const isAuthPage = pathname?.startsWith('/auth');
  const isAdminPage = pathname?.startsWith('/admin');

  // Until the user has saved a pincode (deliverable or not), open the pincode modal on every route
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = readScopedPincode(pinUserId);
    const pin = (raw || '').trim();
    const hasSavedPincode = pin.length === 6 && /^\d{6}$/.test(pin);
    if (!hasSavedPincode) {
      setIsAddressModalOpen(true);
    }
  }, [pathname, pinUserId]);

  // Simulate initial loading (show shimmer for first load)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800); // Show shimmer for 800ms on initial load

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const measure = () => {
      if (headerRef.current) {
        // On mobile, when scrolled, only measure searchRow height
        if (window.innerWidth <= 767 && isScrolled) {
          const searchRow = headerRef.current.querySelector(`.${styles.searchRow}`);
          if (searchRow) {
            setHeaderHeight(searchRow.getBoundingClientRect().height + 0.5); // Add padding
          }
        } else {
          setHeaderHeight(headerRef.current.getBoundingClientRect().height);
        }
      }
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [isScrolled]);

  // Scroll detection for mobile header behavior
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          setIsScrolled(scrollY > 10); // Small threshold to prevent flickering
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Focus overlay search input when mobile search overlay opens; lock body scroll
  useEffect(() => {
    if (isSearchOverlayOpen) {
      if (searchOverlayCloseTimeoutRef.current) {
        clearTimeout(searchOverlayCloseTimeoutRef.current);
        searchOverlayCloseTimeoutRef.current = null;
      }
      setIsSearchOverlayClosing(false);
      setTimeout(() => searchOverlayInputRef.current?.focus(), 50);
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        // Don't restore if another overlay (e.g. ProductDetailsModal) has taken over body
        if (document.body.style.position === 'fixed') return;
        document.body.style.overflow = prev;
      };
    }
  }, [isSearchOverlayOpen]);

  // Clear close timeout on unmount
  useEffect(() => {
    return () => {
      if (searchOverlayCloseTimeoutRef.current) clearTimeout(searchOverlayCloseTimeoutRef.current);
    };
  }, []);

  // Desktop: close search dropdown when clicking outside (left click)
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // only left button
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // If we land on /#membership (e.g., from another route), scroll after the page renders.
  // Only scroll once when the hash is first detected, not on every render or scroll.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const scrollToMembership = () => {
      const el = document.getElementById('membership');
      if (!el) return false;
      const y = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
      return true;
    };

    if (window.location.hash !== '#membership') {
      // Reset the ref when hash changes away from membership
      hasScrolledToMembershipRef.current = false;
      return;
    }

    // If we've already scrolled to membership in this session, don't scroll again
    // This prevents the glitch where scrolling back up triggers another scroll
    if (hasScrolledToMembershipRef.current) return;

    let cancelled = false;
    const tryScroll = (attempt: number) => {
      if (cancelled) return;
      if (scrollToMembership()) {
        hasScrolledToMembershipRef.current = true;
        return;
      }
      if (attempt >= 20) return;
      window.setTimeout(() => tryScroll(attempt + 1), 100);
    };

    // Let Next render the page first.
    window.setTimeout(() => tryScroll(0), 0);
    return () => {
      cancelled = true;
    };
  }, [pathname, headerHeight]);

  const scrollToMembership = () => {
    const el = document.getElementById('membership');
    if (!el) return false;
    const y = el.getBoundingClientRect().top + window.scrollY - headerHeight - 8;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    return true;
  };

  const ensureProducts = () => {
    if (allProducts === null && !isSearchProductsLoading) {
      setIsSearchProductsLoading(true);
      productsApi.getAll().then((p) => {
        setAllProducts(p);
        setIsSearchProductsLoading(false);
      }).catch(() => setIsSearchProductsLoading(false));
    }
  };

  const searchResults = useMemo(() => {
    if (!allProducts || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return allProducts.filter((p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q));
  }, [allProducts, searchQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearching(true);
      if (isMobile) {
        searchOverlayInputRef.current?.blur();
        if (searchOverlayCloseTimeoutRef.current) {
          clearTimeout(searchOverlayCloseTimeoutRef.current);
          searchOverlayCloseTimeoutRef.current = null;
        }
        setIsSearchOverlayClosing(false);
        setIsSearchOverlayOpen(false);
      } else {
        setIsSearchDropdownOpen(false);
        const input = searchWrapRef.current?.querySelector('input') as HTMLInputElement | null;
        input?.blur();
      }
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setTimeout(() => setIsSearching(false), 1000);
    }
  };

  const closeSearchOverlay = () => {
    if (searchOverlayCloseTimeoutRef.current) {
      clearTimeout(searchOverlayCloseTimeoutRef.current);
    }
    setIsSearchOverlayClosing(true);
    searchOverlayCloseTimeoutRef.current = setTimeout(() => {
      setIsSearchOverlayOpen(false);
      setIsSearchOverlayClosing(false);
      searchOverlayCloseTimeoutRef.current = null;
    }, 280);
  };

  // Don't render header on admin pages (AdminHeader handles that)
  // All hooks are called above, so this is safe
  if (isAdminPage) {
    return null;
  }

  return (
    <>
      <header
        ref={headerRef}
        className={[
          isAuthPage ? `${styles.header} ${styles.headerTransparent}` : `${styles.header} ${isScrolled ? styles.headerScrolled : ''}`,
          !isAuthPage && isMobile && savedPincode && savedDeliveryStatus === 'available' && styles.headerMobileBgServiceable,
          !isAuthPage && isMobile && savedPincode && savedDeliveryStatus === 'unavailable' && styles.headerMobileBgUnserviceable
        ].filter(Boolean).join(' ')}
      >
        {/* First Row: Logo and Icons - hidden on mobile when scrolled (only search row stays sticky) */}
        <div className={`${styles.headerRow} ${isScrolled ? styles.headerRowScrolled : ''} ${isScrolled ? styles.headerRowHiddenOnScroll : ''}`}>
          {/* Container for Back Button and Logo/DeliveryAtLogo */}
          <div className={styles.logoContainer}>
            {/* Back Button - Show when not on homepage, mobile only */}
            {isMobile && pathname !== '/' && (
              <button
                type="button"
                className={styles.backButton}
                onClick={() => router.back()}
                aria-label="Go back"
              >
                <svg className={styles.backButtonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            {/* Mobile when serviceable: lightning + "1hr to pincode" in place of logo; else Logo */}
            {isMobile && savedPincode && savedDeliveryStatus === 'available' ? (
              <button
                type="button"
                className={`${styles.deliveryAtLogo} ${styles.deliveryIconAvailable} ${pathname === '/' ? styles.logoOnHomepage : ''}`}
                onClick={() => setIsAddressModalOpen(true)}
                aria-label="Delivery to pincode"
              >
                <svg className={styles.deliveryAtLogoIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
                <div className={styles.deliveryAtLogoText}>
                  <span className={styles.deliverToTime}>{formatDeliveryTimeDisplay(getDeliveryTimeFor(savedPincode))}</span>
                  <span className={styles.deliverToAddress}>to {savedPincode}</span>
                </div>
              </button>
            ) : (
              <Link
                href="/"
                className={`${styles.logo} ${isScrolled ? styles.logoHiddenMobile : ''} ${pathname === '/' ? styles.logoOnHomepage : ''}`}
              >
                {isLoading ? (
                  <div className={`${styles.logoShimmer} ${styles.shimmer}`}></div>
                ) : (
                  <Logo textClassName={styles.logoText} imageClassName={styles.logoImg} />
                )}
              </Link>
            )}
          </div>

          {/* Desktop Search Bar - Hide on auth pages */}
          {!isAuthPage ? (
            isLoading ? (
              <div className={`${styles.searchShimmer} ${styles.shimmer}`}></div>
            ) : (
              <div className={styles.searchWrap} ref={searchWrapRef}>
                <form onSubmit={handleSearch} className={styles.searchForm}>
                  {!isSearching && (
                    <div className={styles.searchIcon}>
                      <svg viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path d="M15.989 15.4905L19.5 19.0015" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                        </g>
                      </svg>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Search Dairy products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { ensureProducts(); setIsSearchDropdownOpen(true); }}
                    className={styles.searchInput}
                    disabled={isSearching}
                  />
                  {isSearching && (
                    <div className={styles.searchSpinner}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.spinnerIcon}>
                        <circle cx="12" cy="12" r="10" stroke="#000000" strokeWidth="2" strokeOpacity="0.2" fill="none" />
                        <path d="M12 2C6.477 2 2 6.477 2 12" stroke="#000000" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="20 40" />
                      </svg>
                    </div>
                  )}
                </form>
                {searchQuery.trim() && isSearchDropdownOpen && (
                  <div className={styles.searchDropdown}>
                    {isSearchProductsLoading ? (
                      <div className={styles.searchDropdownLoading}>Loading...</div>
                    ) : searchResults.length > 0 ? (
                      <>
                        {searchResults.slice(0, 5).map((p) => {
                          const isOutOfStock = p.isActive === false || (typeof p.quantity === 'number' && p.quantity <= 0);
                          const imageUrl = getPrimaryProductImageUrl(p);
                          const unitLabel = getProductDisplayUnitLabel(p);
                          const displayPrice = getCardDisplayPrice(p);

                          return (
                          <div
                            key={p.id}
                            role="button"
                            tabIndex={0}
                            className={`${styles.searchResultItem} ${isOutOfStock ? styles.searchResultItemOutOfStock : ''}`}
                            onClick={() => setSelectedProduct(p)}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedProduct(p); } }}
                          >
                            {isOutOfStock ? <span className={styles.searchResultOutOfStockBadge}>Out of stock</span> : null}
                            {imageUrl && <img src={imageUrl} alt="" className={styles.searchResultImg} />}
                            <div className={styles.searchResultText}>
                              <span className={styles.searchResultName}>{p.name}</span>
                              <span className={styles.searchResultPrice}>₹{displayPrice}/{unitLabel}</span>
                              <span className={styles.searchResultPrice}>₹{p.pricePerLitre} per litre</span>
                            </div>
                            <button
                              type="button"
                              className={`${styles.searchResultAddBtn} ${isOutOfStock ? styles.searchResultAddBtnDisabled : ''}`}
                              aria-label={isOutOfStock ? `${p.name} is out of stock` : 'Add to cart'}
                              disabled={isOutOfStock}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isOutOfStock) {
                                  showToast('Out of stock', 'error');
                                  return;
                                }
                                const result = addItem({ productId: p.id, quantity: 1 }, p.maxQuantity);
                                showToast(
                                  result.appliedQuantity > 0 && result.ok ? 'Added to cart' : `Maximum order quantity is ${p.maxQuantity ?? 99}`,
                                  result.appliedQuantity > 0 && result.ok ? 'success' : 'error',
                                );
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5V19M5 12H19" /></svg>
                            </button>
                          </div>
                        )})}
                        {searchResults.length > 5 && (
                          <button
                            type="button"
                            className={styles.searchShowMore}
                            onClick={() => {
                              setIsSearchDropdownOpen(false);
                              router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                            }}
                          >
                            Show more
                          </button>
                        )}
                      </>
                    ) : (
                      <div className={styles.searchDropdownEmpty}>No products match</div>
                    )}
                  </div>
                )}
              </div>
            )
          ) : null}

          {/* Right Side Icons - Hide on auth pages */}
          {!isAuthPage ? (
            isLoading ? (
              <div className={styles.rightButtonsShimmer}>
                <div className={`${styles.buttonShimmer} ${styles.shimmer}`}></div>
                <div className={`${styles.buttonShimmer} ${styles.shimmer}`}></div>
                <div className={`${styles.buttonShimmer} ${styles.shimmer}`}></div>
                <div className={`${styles.buttonShimmer} ${styles.shimmer}`}></div>
              </div>
            ) : (
              <div className={styles.rightButtons}>
                {/* Deliver To Address - Mobile icon: hidden when deliveryAtLogo is showing (no repetition); Desktop deliverTo below */}
                {!(isMobile && savedPincode && savedDeliveryStatus === 'available') && (
                  <button
                    className={`${styles.iconButton} ${savedDeliveryStatus === 'available' ? styles.deliveryIconAvailable : savedDeliveryStatus === 'unavailable' ? styles.deliveryIconUnavailable : ''}`}
                    onClick={() => setIsAddressModalOpen(true)}
                    aria-label="Delivery location"
                  >
                    <svg className={styles.buttonIcon} viewBox="0 0 8.4666669 8.4666669" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <g transform="translate(0,-288.53332)">
                        <path d="m 4.2324219,288.79688 c -1.6042437,0 -2.9101556,1.30591 -2.9101563,2.91015 -10e-7,2.82277 2.7460938,4.96875 2.7460938,4.96875 a 0.26460978,0.26460978 0 0 0 0.3300781,0 c 0,0 2.7460996,-2.14598 2.7460937,-4.96875 -3.4e-6,-1.60424 -1.3078657,-2.91015 -2.9121093,-2.91015 z m 0,0.52929 c 1.3182605,0 2.3828097,1.0626 2.3828125,2.38086 4.8e-6,2.30926 -2.0910618,4.13374 -2.3808594,4.38086 -0.2884142,-0.24588 -2.3828134,-2.0707 -2.3828125,-4.38086 5e-7,-1.31826 1.0625988,-2.38086 2.3808594,-2.38086 z" fill="currentColor" />
                        <path d="m 4.2324219,290.38477 c -0.7274912,0 -1.3222633,0.59477 -1.3222657,1.32226 -4.5e-6,0.7275 0.5947697,1.32422 1.3222657,1.32422 0.727496,0 1.3242233,-0.59672 1.3242187,-1.32422 -2.3e-6,-0.72749 -0.5967275,-1.32226 -1.3242187,-1.32226 z m 0,0.52929 c 0.4415089,0 0.7949204,0.35146 0.7949219,0.79297 2.7e-6,0.44151 -0.35341,0.79492 -0.7949219,0.79492 -0.441512,0 -0.7929715,-0.35341 -0.7929688,-0.79492 1.4e-6,-0.44151 0.3514598,-0.79297 0.7929688,-0.79297 z" fill="currentColor" />
                      </g>
                    </svg>
                    <span className={styles.iconButtonText}>Location</span>
                  </button>
                )}

                {/* Desktop Deliver To Address - lightning when eligible, location otherwise; time 0.75rem, "to pincode" 0.875rem */}
                <div className={`${styles.deliverTo} ${savedDeliveryStatus === 'available' ? styles.deliveryIconAvailable : savedDeliveryStatus === 'unavailable' ? styles.deliveryIconUnavailable : ''}`} onClick={() => setIsAddressModalOpen(true)}>
                  {savedDeliveryStatus === 'available' ? (
                    <svg className={styles.locationIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                    </svg>
                  ) : (
                    <svg className={styles.locationIcon} viewBox="0 0 8.4666669 8.4666669" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <g transform="translate(0,-288.53332)">
                        <path d="m 4.2324219,288.79688 c -1.6042437,0 -2.9101556,1.30591 -2.9101563,2.91015 -10e-7,2.82277 2.7460938,4.96875 2.7460938,4.96875 a 0.26460978,0.26460978 0 0 0 0.3300781,0 c 0,0 2.7460996,-2.14598 2.7460937,-4.96875 -3.4e-6,-1.60424 -1.3078657,-2.91015 -2.9121093,-2.91015 z m 0,0.52929 c 1.3182605,0 2.3828097,1.0626 2.3828125,2.38086 4.8e-6,2.30926 -2.0910618,4.13374 -2.3808594,4.38086 -0.2884142,-0.24588 -2.3828134,-2.0707 -2.3828125,-4.38086 5e-7,-1.31826 1.0625988,-2.38086 2.3808594,-2.38086 z" fill="currentColor" />
                        <path d="m 4.2324219,290.38477 c -0.7274912,0 -1.3222633,0.59477 -1.3222657,1.32226 -4.5e-6,0.7275 0.5947697,1.32422 1.3222657,1.32422 0.727496,0 1.3242233,-0.59672 1.3242187,-1.32422 -2.3e-6,-0.72749 -0.5967275,-1.32226 -1.3242187,-1.32226 z m 0,0.52929 c 0.4415089,0 0.7949204,0.35146 0.7949219,0.79297 2.7e-6,0.44151 -0.35341,0.79492 -0.7949219,0.79492 -0.441512,0 -0.7929715,-0.35341 -0.7929688,-0.79492 1.4e-6,-0.44151 0.3514598,-0.79297 0.7929688,-0.79297 z" fill="currentColor" />
                      </g>
                    </svg>
                  )}
                  <div className={styles.deliverToContent}>
                    {savedPincode && savedDeliveryStatus ? (
                      savedDeliveryStatus === 'available' ? (
                        <>
                          <span className={styles.deliverToTime}>{formatDeliveryTimeDisplay(getDeliveryTimeFor(savedPincode))}</span>
                          <span className={styles.deliverToAddress}>to {savedPincode}</span>
                        </>
                      ) : (
                        <>
                          <span className={styles.deliverToLabel}>Not available:</span>
                          <span className={styles.deliverToAddress}>{savedPincode}</span>
                        </>
                      )
                    ) : (
                      <>
                        <span className={styles.deliverToLabel}>Deliver to:</span>
                        <span className={styles.deliverToAddress}>Enter pincode</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Membership Button - Icon Only on Mobile */}
                <Link
                  href="/#membership"
                  className={styles.iconButton}
                  onClick={(e) => {
                    // If we're already on the homepage, don't navigate — just scroll.
                    if (pathname === '/') {
                      e.preventDefault();
                      // Reset the ref to allow scrolling
                      hasScrolledToMembershipRef.current = false;
                      if (scrollToMembership()) {
                        window.history.pushState(null, '', '#membership');
                        // Mark as scrolled after a short delay to allow smooth scroll
                        setTimeout(() => {
                          hasScrolledToMembershipRef.current = true;
                        }, 1000);
                      }
                      return;
                    }

                    // For other routes, navigate to the homepage anchor (effect above will scroll after render).
                    e.preventDefault();
                    hasScrolledToMembershipRef.current = false;
                    router.push('/#membership');
                  }}
                  aria-label="Subscription"
                >
                  <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      <path d="M21.609 13.5616L21.8382 11.1263C22.0182 9.2137 22.1082 8.25739 21.781 7.86207C21.604 7.64823 21.3633 7.5172 21.106 7.4946C20.6303 7.45282 20.0329 8.1329 18.8381 9.49307C18.2202 10.1965 17.9113 10.5482 17.5666 10.6027C17.3757 10.6328 17.1811 10.6018 17.0047 10.5131C16.6865 10.3529 16.4743 9.91812 16.0499 9.04851L13.8131 4.46485C13.0112 2.82162 12.6102 2 12 2C11.3898 2 10.9888 2.82162 10.1869 4.46486L7.95007 9.04852C7.5257 9.91812 7.31351 10.3529 6.99526 10.5131C6.81892 10.6018 6.62434 10.6328 6.43337 10.6027C6.08872 10.5482 5.77977 10.1965 5.16187 9.49307C3.96708 8.1329 3.36968 7.45282 2.89399 7.4946C2.63666 7.5172 2.39598 7.64823 2.21899 7.86207C1.8918 8.25739 1.9818 9.2137 2.16181 11.1263L2.391 13.5616C2.76865 17.5742 2.95748 19.5805 4.14009 20.7902C5.32271 22 7.09517 22 10.6401 22H13.3599C16.9048 22 18.6773 22 19.8599 20.7902C21.0425 19.5805 21.2313 17.5742 21.609 13.5616Z" stroke="currentColor" strokeWidth="1.5"></path>
                    </g>
                  </svg>
                  <span className={styles.iconButtonText}>Subscription</span>
                </Link>

                {/* Desktop Trial Pack Button */}
                <Link href="/#membership" className={styles.trialPackButton}>
                  <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" aria-hidden="true">
                    <path d="M20.808,11.079C19.829,16.132,12,20.5,12,20.5s-7.829-4.368-8.808-9.421C2.227,6.1,5.066,3.5,8,3.5a4.444,4.444,0,0,1,4,2,4.444,4.444,0,0,1,4-2C18.934,3.5,21.773,6.1,20.808,11.079Z"></path>
                  </svg>
                  Grab Trial Pack
                </Link>

                {/* Desktop Membership Button */}
                <Link
                  href="/#membership"
                  className={styles.membershipButton}
                  onClick={(e) => {
                    // If we're already on the homepage, don't navigate — just scroll.
                    if (pathname === '/') {
                      e.preventDefault();
                      // Reset the ref to allow scrolling
                      hasScrolledToMembershipRef.current = false;
                      if (scrollToMembership()) {
                        window.history.pushState(null, '', '#membership');
                        // Mark as scrolled after a short delay to allow smooth scroll
                        setTimeout(() => {
                          hasScrolledToMembershipRef.current = true;
                        }, 1000);
                      }
                      return;
                    }

                    // For other routes, navigate to the homepage anchor (effect above will scroll after render).
                    e.preventDefault();
                    hasScrolledToMembershipRef.current = false;
                    router.push('/#membership');
                  }}
                >
                  <svg className={styles.buttonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
                    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      <path d="M21.609 13.5616L21.8382 11.1263C22.0182 9.2137 22.1082 8.25739 21.781 7.86207C21.604 7.64823 21.3633 7.5172 21.106 7.4946C20.6303 7.45282 20.0329 8.1329 18.8381 9.49307C18.2202 10.1965 17.9113 10.5482 17.5666 10.6027C17.3757 10.6328 17.1811 10.6018 17.0047 10.5131C16.6865 10.3529 16.4743 9.91812 16.0499 9.04851L13.8131 4.46485C13.0112 2.82162 12.6102 2 12 2C11.3898 2 10.9888 2.82162 10.1869 4.46486L7.95007 9.04852C7.5257 9.91812 7.31351 10.3529 6.99526 10.5131C6.81892 10.6018 6.62434 10.6328 6.43337 10.6027C6.08872 10.5482 5.77977 10.1965 5.16187 9.49307C3.96708 8.1329 3.36968 7.45282 2.89399 7.4946C2.63666 7.5172 2.39598 7.64823 2.21899 7.86207C1.8918 8.25739 1.9818 9.2137 2.16181 11.1263L2.391 13.5616C2.76865 17.5742 2.95748 19.5805 4.14009 20.7902C5.32271 22 7.09517 22 10.6401 22H13.3599C16.9048 22 18.6773 22 19.8599 20.7902C21.0425 19.5805 21.2313 17.5742 21.609 13.5616Z" stroke="currentColor" strokeWidth="1.5"></path>
                    </g>
                  </svg>
                  Subscription
                </Link>

                {/* Login/User Button - Icon Only on Mobile */}
                {isAuthenticated ? (
                  <UserDropdown user={user} logout={logout} isAdmin={isAdmin} isMobile={true} />
                ) : (
                  <Link
                    href="/auth/login"
                    className={styles.iconButton}
                    aria-label="Login"
                  >
                    <svg className={styles.buttonIcon} viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="0.00024000000000000003">
                      <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                      <g id="SVGRepo_iconCarrier">
                        <path fillRule="evenodd" clipRule="evenodd" d="M8.25 9C8.25 6.92893 9.92893 5.25 12 5.25C14.0711 5.25 15.75 6.92893 15.75 9C15.75 11.0711 14.0711 12.75 12 12.75C9.92893 12.75 8.25 11.0711 8.25 9ZM12 6.75C10.7574 6.75 9.75 7.75736 9.75 9C9.75 10.2426 10.7574 11.25 12 11.25C13.2426 11.25 14.25 10.2426 14.25 9C14.25 7.75736 13.2426 6.75 12 6.75Z" fill="currentColor"></path>
                        <path fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 14.5456 3.77827 16.851 5.4421 18.5235C5.6225 17.5504 5.97694 16.6329 6.68837 15.8951C7.75252 14.7915 9.45416 14.25 12 14.25C14.5457 14.25 16.2474 14.7915 17.3115 15.8951C18.023 16.6329 18.3774 17.5505 18.5578 18.5236C20.2217 16.8511 21.25 14.5456 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM17.1937 19.6554C17.0918 18.4435 16.8286 17.5553 16.2318 16.9363C15.5823 16.2628 14.3789 15.75 12 15.75C9.62099 15.75 8.41761 16.2628 7.76815 16.9363C7.17127 17.5553 6.90811 18.4434 6.80622 19.6553C8.28684 20.6618 10.0747 21.25 12 21.25C13.9252 21.25 15.7131 20.6618 17.1937 19.6554Z" fill="currentColor"></path>
                      </g>
                    </svg>
                    <span className={styles.iconButtonText}>Login</span>
                  </Link>
                )}

                {/* Desktop Login/User Button */}
                <div className={styles.callMenu} ref={callMenuRef}>
                  <button
                    type="button"
                    className={styles.callButton}
                    aria-haspopup="dialog"
                    aria-expanded={isCallMenuOpen}
                    onClick={() => setIsCallMenuOpen((prev) => !prev)}
                  >
                    <svg
                      className={styles.buttonIcon}
                      viewBox="0 0 32 32"
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      stroke="currentColor"
                      strokeWidth="0.896"
                      aria-hidden="true"
                    >
                      <path d="M23.407 30.394c-2.431 0-8.341-3.109-13.303-9.783-4.641-6.242-6.898-10.751-6.898-13.785 0-2.389 1.65-3.529 2.536-4.142l0.219-0.153c0.979-0.7 2.502-0.927 3.086-0.927 1.024 0 1.455 0.599 1.716 1.121 0.222 0.442 2.061 4.39 2.247 4.881 0.286 0.755 0.192 1.855-0.692 2.488l-0.155 0.108c-0.439 0.304-1.255 0.869-1.368 1.557-0.055 0.334 0.057 0.684 0.342 1.068 1.423 1.918 5.968 7.55 6.787 8.314 0.642 0.6 1.455 0.685 2.009 0.218 0.573-0.483 0.828-0.768 0.83-0.772l0.059-0.057c0.048-0.041 0.496-0.396 1.228-0.396 0.528 0 1.065 0.182 1.596 0.541 1.378 0.931 4.487 3.011 4.487 3.011l0.050 0.038c0.398 0.341 0.973 1.323 0.302 2.601-0.695 1.327-2.85 4.066-5.079 4.066zM9.046 2.672c-0.505 0-1.746 0.213-2.466 0.728l-0.232 0.162c-0.827 0.572-2.076 1.435-2.076 3.265 0 2.797 2.188 7.098 6.687 13.149 4.914 6.609 10.532 9.353 12.447 9.353 1.629 0 3.497-2.276 4.135-3.494 0.392-0.748 0.071-1.17-0.040-1.284-0.36-0.241-3.164-2.117-4.453-2.988-0.351-0.238-0.688-0.358-0.999-0.358-0.283 0-0.469 0.1-0.532 0.14-0.104 0.111-0.39 0.405-0.899 0.833-0.951 0.801-2.398 0.704-3.424-0.254-0.923-0.862-5.585-6.666-6.916-8.459-0.46-0.62-0.641-1.252-0.538-1.877 0.187-1.133 1.245-1.866 1.813-2.26l0.142-0.099c0.508-0.363 0.4-1.020 0.316-1.242-0.157-0.414-1.973-4.322-2.203-4.781-0.188-0.376-0.336-0.533-0.764-0.533z"></path>
                    </svg>
                    Call
                  </button>

                  {isCallMenuOpen ? (
                    <div className={styles.callDropdown} role="dialog" aria-label="Call support menu">
                      <div className={styles.callDropdownTitle}>Question in mind?</div>
                      <p className={styles.callDropdownDescription}>We are here for any doubts of yours</p>

                      <a
                        href={telHref}
                        className={`${styles.callActionButton} ${!hasContactPhone ? styles.callActionButtonDisabled : ''}`}
                        onClick={() => setIsCallMenuOpen(false)}
                        aria-disabled={!hasContactPhone}
                      >
                        <svg className={styles.callActionIcon} viewBox="0 0 32 32" version="1.1" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" strokeWidth="0.896" aria-hidden="true">
                          <path d="M23.407 30.394c-2.431 0-8.341-3.109-13.303-9.783-4.641-6.242-6.898-10.751-6.898-13.785 0-2.389 1.65-3.529 2.536-4.142l0.219-0.153c0.979-0.7 2.502-0.927 3.086-0.927 1.024 0 1.455 0.599 1.716 1.121 0.222 0.442 2.061 4.39 2.247 4.881 0.286 0.755 0.192 1.855-0.692 2.488l-0.155 0.108c-0.439 0.304-1.255 0.869-1.368 1.557-0.055 0.334 0.057 0.684 0.342 1.068 1.423 1.918 5.968 7.55 6.787 8.314 0.642 0.6 1.455 0.685 2.009 0.218 0.573-0.483 0.828-0.768 0.83-0.772l0.059-0.057c0.048-0.041 0.496-0.396 1.228-0.396 0.528 0 1.065 0.182 1.596 0.541 1.378 0.931 4.487 3.011 4.487 3.011l0.050 0.038c0.398 0.341 0.973 1.323 0.302 2.601-0.695 1.327-2.85 4.066-5.079 4.066zM9.046 2.672c-0.505 0-1.746 0.213-2.466 0.728l-0.232 0.162c-0.827 0.572-2.076 1.435-2.076 3.265 0 2.797 2.188 7.098 6.687 13.149 4.914 6.609 10.532 9.353 12.447 9.353 1.629 0 3.497-2.276 4.135-3.494 0.392-0.748 0.071-1.17-0.040-1.284-0.36-0.241-3.164-2.117-4.453-2.988-0.351-0.238-0.688-0.358-0.999-0.358-0.283 0-0.469 0.1-0.532 0.14-0.104 0.111-0.39 0.405-0.899 0.833-0.951 0.801-2.398 0.704-3.424-0.254-0.923-0.862-5.585-6.666-6.916-8.459-0.46-0.62-0.641-1.252-0.538-1.877 0.187-1.133 1.245-1.866 1.813-2.26l0.142-0.099c0.508-0.363 0.4-1.020 0.316-1.242-0.157-0.414-1.973-4.322-2.203-4.781-0.188-0.376-0.336-0.533-0.764-0.533z"></path>
                        </svg>
                        <span>{contactPhoneLabel}</span>
                      </a>

                      <div className={styles.callDivider}>
                        <span className={styles.callDividerLine} aria-hidden="true"></span>
                        <span className={styles.callDividerText}>OR</span>
                        <span className={styles.callDividerLine} aria-hidden="true"></span>
                      </div>

                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noreferrer"
                        className={`${styles.callActionButton} ${styles.callWhatsappButton} ${!hasContactPhone ? styles.callActionButtonDisabled : ''}`}
                        onClick={() => setIsCallMenuOpen(false)}
                        aria-disabled={!hasContactPhone}
                      >
                        <svg className={styles.callActionIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path d="M2 22L3.41152 16.8691C2.54422 15.3639 2.08876 13.6568 2.09099 11.9196C2.08095 6.44549 6.52644 2 11.99 2C14.6417 2 17.1315 3.02806 19.0062 4.9034C19.9303 5.82266 20.6627 6.91616 21.1611 8.12054C21.6595 9.32492 21.9139 10.6162 21.9096 11.9196C21.9096 17.3832 17.4641 21.8287 12 21.8287C10.3368 21.8287 8.71374 21.4151 7.26204 20.6192L2 22ZM7.49424 18.8349L7.79675 19.0162C9.06649 19.7676 10.5146 20.1644 11.99 20.1654C16.5264 20.1654 20.2263 16.4662 20.2263 11.9291C20.2263 9.73176 19.3696 7.65554 17.8168 6.1034C17.0533 5.33553 16.1453 4.72636 15.1453 4.31101C14.1452 3.89565 13.0728 3.68232 11.99 3.68331C7.44343 3.6839 3.74476 7.38316 3.74476 11.9202C3.74476 13.4724 4.17843 14.995 5.00502 16.3055L5.19645 16.618L4.35982 19.662L7.49483 18.8354L7.49424 18.8349Z" fill="#ffffff"></path>
                          <path fillRule="evenodd" clipRule="evenodd" d="M9.52024 7.76662C9.33885 7.35303 9.13737 7.34298 8.96603 7.34298C8.81477 7.33294 8.65288 7.33294 8.48154 7.33294C8.32083 7.33294 8.04845 7.39321 7.81684 7.64549C7.58464 7.89719 6.95007 8.49217 6.95007 9.71167C6.95007 10.9318 7.83693 12.1111 7.95805 12.2724C8.07858 12.4337 9.67149 15.0139 12.192 16.0124C14.2883 16.839 14.712 16.6777 15.1657 16.6269C15.6189 16.5767 16.6275 16.0325 16.839 15.4476C17.0405 14.8733 17.0405 14.3693 16.9802 14.2682C16.9199 14.1678 16.748 14.1069 16.5064 13.9758C16.2541 13.8552 15.0446 13.2502 14.813 13.1693C14.5808 13.0889 14.4195 13.0487 14.2582 13.2904C14.0969 13.5427 13.623 14.0969 13.4724 14.2582C13.3306 14.4195 13.1799 14.4396 12.9377 14.3185C12.686 14.1979 11.8895 13.9356 10.9418 13.0889C10.2056 12.4331 9.71167 11.6171 9.56041 11.3755C9.41979 11.1232 9.54032 10.992 9.67149 10.8709C9.78257 10.7604 9.92378 10.579 10.0449 10.4378C10.1654 10.296 10.2056 10.1855 10.2966 10.0242C10.377 9.86292 10.3368 9.71167 10.2765 9.59114C10.2157 9.48006 9.74239 8.25997 9.52024 7.76603V7.76662Z" fill="#ffffff"></path>
                        </svg>
                        <span>{contactPhoneLabel}</span>
                      </a>

                      <Link href="/contact" className={styles.callLearnMore} onClick={() => setIsCallMenuOpen(false)}>
                        Click to learn more
                      </Link>
                    </div>
                  ) : null}
                </div>

                {isAuthenticated ? (
                  <UserDropdown user={user} logout={logout} isAdmin={isAdmin} />
                ) : (
                  <Link
                    href="/auth/login"
                    className={styles.loginButton}
                  >
                    <svg className={styles.buttonIcon} viewBox="0 0 24.00 24.00" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="0.00024000000000000003">
                      <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                      <g id="SVGRepo_iconCarrier">
                        <path fillRule="evenodd" clipRule="evenodd" d="M8.25 9C8.25 6.92893 9.92893 5.25 12 5.25C14.0711 5.25 15.75 6.92893 15.75 9C15.75 11.0711 14.0711 12.75 12 12.75C9.92893 12.75 8.25 11.0711 8.25 9ZM12 6.75C10.7574 6.75 9.75 7.75736 9.75 9C9.75 10.2426 10.7574 11.25 12 11.25C13.2426 11.25 14.25 10.2426 14.25 9C14.25 7.75736 13.2426 6.75 12 6.75Z" fill="currentColor"></path>
                        <path fillRule="evenodd" clipRule="evenodd" d="M1.25 12C1.25 6.06294 6.06294 1.25 12 1.25C17.9371 1.25 22.75 6.06294 22.75 12C22.75 17.9371 17.9371 22.75 12 22.75C6.06294 22.75 1.25 17.9371 1.25 12ZM12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 14.5456 3.77827 16.851 5.4421 18.5235C5.6225 17.5504 5.97694 16.6329 6.68837 15.8951C7.75252 14.7915 9.45416 14.25 12 14.25C14.5457 14.25 16.2474 14.7915 17.3115 15.8951C18.023 16.6329 18.3774 17.5505 18.5578 18.5236C20.2217 16.8511 21.25 14.5456 21.25 12C21.25 6.89137 17.1086 2.75 12 2.75ZM17.1937 19.6554C17.0918 18.4435 16.8286 17.5553 16.2318 16.9363C15.5823 16.2628 14.3789 15.75 12 15.75C9.62099 15.75 8.41761 16.2628 7.76815 16.9363C7.17127 17.5553 6.90811 18.4434 6.80622 19.6553C8.28684 20.6618 10.0747 21.25 12 21.25C13.9252 21.25 15.7131 20.6618 17.1937 19.6554Z" fill="currentColor"></path>
                      </g>
                    </svg>
                    Login
                  </Link>
                )}

                {/* Cart Button - Icon Only on Mobile */}
                <Link
                  href="/cart"
                  className={styles.iconButton}
                  aria-label="Cart"
                >
                  <div ref={cartButtonMobileRef as any} className={styles.cartIconWrapper}>
                    <svg className={`${styles.buttonIcon} ${styles.cartIcon}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                      <g id="SVGRepo_iconCarrier">
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11M8 8H16C19 8 20 11.8899 20 13.5C20 19.5259 18.3966 20.5 12 20.5C5.60338 20.5 4 19.5259 4 13.5C4 11.8899 5 8 8 8Z" stroke="currentColor" strokeWidth="1.488" strokeLinecap="round" strokeLinejoin="round"></path>
                      </g>
                    </svg>
                    {itemCount > 0 && (
                      <span className={styles.cartBadge}>{itemCount}</span>
                    )}
                  </div>
                  <span className={styles.iconButtonText}>Cart</span>
                </Link>

                {/* Desktop Cart Button */}
                <Link
                  href="/cart"
                  className={styles.cartButton}
                >
                  <div ref={cartButtonDesktopRef as any} className={styles.cartIconWrapper}>
                    <svg className={`${styles.buttonIcon} ${styles.cartIcon}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                      <g id="SVGRepo_iconCarrier">
                        <path d="M8 11V7C8 4.79086 9.79086 3 12 3C14.2091 3 16 4.79086 16 7V11M8 8H16C19 8 20 11.8899 20 13.5C20 19.5259 18.3966 20.5 12 20.5C5.60338 20.5 4 19.5259 4 13.5C4 11.8899 5 8 8 8Z" stroke="currentColor" strokeWidth="1.488" strokeLinecap="round" strokeLinejoin="round"></path>
                      </g>
                    </svg>
                    {itemCount > 0 && (
                      <span className={styles.cartBadge}>{itemCount}</span>
                    )}
                  </div>
                  Cart
                </Link>
              </div>
            )
          ) : null}
        </div>

        {/* Second Row: Search Bar - Mobile Only; sticky at top when scrolled (first row hides) */}
        {!isAuthPage ? (
          <div className={`${styles.searchRow} ${isScrolled ? styles.searchRowSticky : ''}`}>
            {isLoading ? (
              <div className={`${styles.searchShimmer} ${styles.shimmer}`}></div>
            ) : (
              <>
                {/* Back Button on Mobile Search Row when scrolled */}
                {isMobile && isScrolled && pathname !== '/' && (
                  <div className={styles.logoContainer}>
                    <button
                      type="button"
                      className={styles.backButton}
                      onClick={() => router.back()}
                      aria-label="Go back"
                    >
                      <svg className={styles.backButtonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5M12 19l-7-7 7-7" />
                      </svg>
                    </button>
                  </div>
                )}
                <form onSubmit={handleSearch} className={styles.searchForm}>
                  {!isSearching && (
                    <div className={styles.searchIcon}>
                      <svg viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                        <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                        <g id="SVGRepo_iconCarrier">
                          <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                          <path d="M15.989 15.4905L19.5 19.0015" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                        </g>
                      </svg>
                    </div>
                  )}
                  <input
                    type="text"
                    placeholder="Search Dairy products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={() => { ensureProducts(); setIsSearchOverlayOpen(true); }}
                    className={styles.searchInput}
                    disabled={isSearching}
                  />
                  {isSearching && (
                    <div className={styles.searchSpinner}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={styles.spinnerIcon}>
                        <circle cx="12" cy="12" r="10" stroke="#000000" strokeWidth="2" strokeOpacity="0.2" fill="none" />
                        <path d="M12 2C6.477 2 2 6.477 2 12" stroke="#000000" strokeWidth="2" strokeLinecap="round" fill="none" strokeDasharray="20 40" />
                      </svg>
                    </div>
                  )}
                </form>
              </>
            )}
          </div>
        ) : null}

        {/* Address Modal */}
        {isAddressModalOpen ? (
          <div className={styles.modalOverlay} onClick={() => setIsAddressModalOpen(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className={styles.modalHeader}>
                <h2 className={styles.modalTitle}>Enter your pincode</h2>
                <button
                  className={styles.modalCloseButton}
                  onClick={() => setIsAddressModalOpen(false)}
                  aria-label="Close"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>

              {/* Delivery Location Text */}
              <p className={styles.deliveryLocationText}>Delivering only to Gwalior, Madhya Pradesh</p>

              {/* Pincode Field - 6 separate boxes */}
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Pincode</label>
                <div className={styles.pincodeBoxes}>
                  {pincode.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => { pincodeInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={digit}
                      onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        if (value.length <= 1) {
                          const newPincode = [...pincode];
                          newPincode[index] = value;
                          setPincode(newPincode);

                          // Auto-focus next box if value entered
                          if (value && index < 5) {
                            pincodeInputRefs.current[index + 1]?.focus();
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        // Handle backspace to go to previous box
                        if (e.key === 'Backspace' && !pincode[index] && index > 0) {
                          pincodeInputRefs.current[index - 1]?.focus();
                        }
                      }}
                      onPaste={(e) => {
                        e.preventDefault();
                        const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
                        const newPincode = [...pincode];
                        for (let i = 0; i < 6; i++) {
                          newPincode[i] = pastedData[i] || '';
                        }
                        setPincode(newPincode);
                        // Focus the last filled box or next empty box
                        const nextIndex = Math.min(pastedData.length, 5);
                        pincodeInputRefs.current[nextIndex]?.focus();
                      }}
                      className={styles.pincodeBox}
                      maxLength={1}
                      autoComplete="off"
                    />
                  ))}
                </div>
              </div>

              {/* Delivery status */}
              {(deliveryStatus === 'checking' ||
                deliveryStatus === 'available' ||
                deliveryStatus === 'unavailable') && (
                  <div
                    className={`${styles.deliveryStatusMessage} ${deliveryStatus === 'checking'
                        ? styles.deliveryStatusInfo
                        : deliveryStatus === 'available'
                          ? styles.deliveryStatusSuccess
                          : styles.deliveryStatusError
                      }`}
                  >
                    {deliveryStatus === 'checking' ? (
                      <>
                        <svg className={styles.statusIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                          <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <span>Checking availability…</span>
                      </>
                    ) : deliveryStatus === 'available' ? (
                      <>
                        <svg className={styles.statusIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{pincode.join('')} available to deliver</span>
                      </>
                    ) : (
                      <>
                        <svg className={styles.statusIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span>{pincode.join('')} not available to deliver</span>
                      </>
                    )}
                  </div>
                )}

              {/* Check/Done Button */}
              <button
                className={`${styles.modalDoneButton} ${deliveryStatus === 'available' ? styles.modalDoneButtonSuccess :
                    deliveryStatus === 'unavailable' ? styles.modalDoneButtonError : ''
                  }`}
                onClick={() => {
                  const fullPincode = pincode.join('');
                  if (fullPincode.length !== 6) return;

                  if (deliveryStatus === null || deliveryStatus === 'checking') {
                    checkPincodeDelivery();
                  } else {
                    handleDone();
                  }
                }}
                disabled={pincode.join('').length !== 6 || deliveryStatus === 'checking'}
                style={{
                  opacity: pincode.join('').length === 6 && deliveryStatus !== 'checking' ? 1 : 0.5,
                  cursor:
                    pincode.join('').length === 6 && deliveryStatus !== 'checking' ? 'pointer' : 'not-allowed',
                }}
              >
                {deliveryStatus === 'checking' ? 'Checking...' :
                  deliveryStatus === 'available' || deliveryStatus === 'unavailable' ? 'Done' : 'Check'}
              </button>
            </div>
          </div>
        ) : null}
      </header>

      {/* Mobile: full-page white search overlay when search is focused */}
      {isMobile && isSearchOverlayOpen && (
        <div
          className={`${styles.searchOverlay} ${isSearchOverlayClosing ? styles.searchOverlayClosing : ''} ${selectedProduct ? styles.searchOverlayBehindModal : ''}`}
        >
          <div className={styles.searchOverlayBar}>
            <form onSubmit={handleSearch} className={`${styles.searchForm} ${styles.searchOverlayForm}`}>
              <div className={styles.searchIcon}>
                <svg viewBox="0 -0.5 25 25" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                    <path d="M15.989 15.4905L19.5 19.0015" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
                  </g>
                </svg>
              </div>
              <input
                ref={searchOverlayInputRef}
                type="text"
                placeholder="Search Dairy products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
                autoComplete="off"
              />
            </form>
            <button type="button" className={styles.searchOverlayClose} onClick={closeSearchOverlay} aria-label="Close search">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
          <div className={styles.searchOverlayResults}>
            {isSearchProductsLoading ? (
              <p className={styles.searchOverlayStatus}>Loading...</p>
            ) : searchQuery.trim() ? (
              searchResults.length > 0 ? (
                <>
                  {searchResults.slice(0, 5).map((p) => {
                    const isOutOfStock = p.isActive === false || (typeof p.quantity === 'number' && p.quantity <= 0);
                    const imageUrl = getPrimaryProductImageUrl(p);
                    const unitLabel = getProductDisplayUnitLabel(p);
                    const displayPrice = getCardDisplayPrice(p);

                    return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      className={`${styles.searchOverlayRow} ${isOutOfStock ? styles.searchOverlayRowOutOfStock : ''}`}
                      onClick={() => setSelectedProduct(p)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedProduct(p);
                        }
                      }}
                    >
                      {isOutOfStock ? <span className={styles.searchOverlayOutOfStockBadge}>Out of stock</span> : null}
                      {imageUrl ? <img src={imageUrl} alt="" className={styles.searchOverlayRowImg} /> : <div className={styles.searchOverlayRowImg} />}
                      <div className={styles.searchOverlayRowText}>
                        <span className={styles.searchOverlayRowName}>{p.name}</span>
                        <span className={styles.searchOverlayRowPrice}>₹{displayPrice}/{unitLabel}</span>
                        <span className={styles.searchOverlayRowPrice}>₹{p.pricePerLitre} per litre</span>
                      </div>
                      <button
                        type="button"
                        className={`${styles.searchOverlayRowAddBtn} ${isOutOfStock ? styles.searchOverlayRowAddBtnDisabled : ''}`}
                        aria-label={isOutOfStock ? `${p.name} is out of stock` : 'Add to cart'}
                        disabled={isOutOfStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isOutOfStock) {
                            showToast('Out of stock', 'error');
                            return;
                          }
                          const result = addItem({ productId: p.id, quantity: 1 }, p.maxQuantity);
                          showToast(
                            result.appliedQuantity > 0 && result.ok ? 'Added to cart' : `Maximum order quantity is ${p.maxQuantity ?? 99}`,
                            result.appliedQuantity > 0 && result.ok ? 'success' : 'error',
                          );
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5V19M5 12H19" /></svg>
                      </button>
                    </div>
                  )})}
                  {searchResults.length > 5 && (
                    <button
                      type="button"
                      className={styles.searchShowMore}
                      onClick={() => {
                        closeSearchOverlay();
                        router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
                      }}
                    >
                      Show more
                    </button>
                  )}
                </>
              ) : (
                <p className={styles.searchOverlayStatus}>No products match</p>
              )
            ) : (
              <p className={styles.searchOverlayStatus}>Type to search products</p>
            )}
          </div>
        </div>
      )}

      {/* Product details modal (from search results) */}
      {selectedProduct && (
        <ProductDetailsModal
          product={selectedProduct}
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Spacer so content doesn't go under fixed header (keep auth pages overlay) */}
      {!isAuthPage ? (
        <div
          className={styles.headerSpacer}
          style={{ height: headerHeight }}
          aria-hidden="true"
        />
      ) : null}
    </>
  );
}
