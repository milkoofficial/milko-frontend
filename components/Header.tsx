'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styles from './Header.module.css';
import { User } from '@/types';
import { cartIconRefStore } from '@/lib/utils/cartIconRef';
import { contentApi } from '@/lib/api';

/**
 * User Dropdown Component
 * Shows "Hi, [name]" with dropdown menu
 */
function UserDropdown({ user, logout, isAdmin, isMobile = false }: { user: User | null; logout: () => void; isAdmin: boolean; isMobile?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
    router.push('/');
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
          <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      {isOpen && (
        <div className={styles.dropdownMenu}>
          <Link href="/dashboard" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12C14.7614 12 17 9.76142 17 7C17 4.23858 14.7614 2 12 2C9.23858 2 7 4.23858 7 7C7 9.76142 9.23858 12 12 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.5899 22C20.5899 18.13 16.7399 15 11.9999 15C7.25991 15 3.40991 18.13 3.40991 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            My Account
          </Link>
          <Link href="/orders" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 16V8C21 7.46957 20.7893 6.96086 20.4142 6.58579C20.0391 6.21071 19.5304 6 19 6H5C4.46957 6 3.96086 6.21071 3.58579 6.58579C3.21071 6.96086 3 7.46957 3 8V16C3 16.5304 3.21071 17.0391 3.58579 17.4142C3.96086 17.7893 4.46957 18 5 18H19C19.5304 18 20.0391 17.7893 20.4142 17.4142C20.7893 17.0391 21 16.5304 21 16Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 10H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8 14H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Orders
          </Link>
          <Link href="/subscriptions" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M5 16L3 5L8.5 10L12 8L15.5 10L21 5L19 16H5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 16H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Subscriptions
          </Link>
          <Link href="/reviews" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Reviews
          </Link>
          {isAdmin && (
            <Link href="/admin" className={styles.dropdownItem} onClick={() => setIsOpen(false)}>
              <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 3H10V10H3V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 3H21V10H14V3Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 14H10V21H3V14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M14 14H21V21H14V14Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Panel
            </Link>
          )}
          <button className={styles.dropdownItem} onClick={handleLogout}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 17L21 12L16 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M21 12H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Logout
          </button>
        </div>
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
  const { itemCount } = useCart();
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [pincode, setPincode] = useState(['', '', '', '', '', '']);
  const [deliveryStatus, setDeliveryStatus] = useState<'checking' | 'available' | 'unavailable' | null>(null);
  const [savedPincode, setSavedPincode] = useState<string | null>(null);
  const [savedDeliveryStatus, setSavedDeliveryStatus] = useState<'available' | 'unavailable' | null>(null);
  const [serviceablePincodes, setServiceablePincodes] = useState<string[] | null>(null);
  const pincodeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Load saved pincode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('milko_delivery_pincode');
    if (saved) {
      setSavedPincode(saved);
    }
  }, []);

  // Load serviceable pincode(s) from admin-configured site content
  useEffect(() => {
    (async () => {
      try {
        const cfg = await contentApi.getByType('pincodes');
        const meta = (cfg?.metadata || {}) as any;
        const list: string[] = Array.isArray(meta.serviceablePincodes)
          ? meta.serviceablePincodes
          : (typeof meta.serviceablePincode === 'string' && meta.serviceablePincode.trim()
              ? [meta.serviceablePincode.trim()]
              : []);
        setServiceablePincodes(list);
      } catch {
        // No config -> allow all
        setServiceablePincodes(null);
      }
    })();
  }, []);

  const isDeliverable = (pin: string) => {
    const cleaned = (pin || '').trim();
    if (cleaned.length !== 6) return false;
    if (!serviceablePincodes || serviceablePincodes.length === 0) return true;
    return serviceablePincodes.includes(cleaned);
  };

  // If we have a saved pincode, compute saved status based on current config
  useEffect(() => {
    if (!savedPincode || savedPincode.length !== 6) return;
    const ok = isDeliverable(savedPincode);
    setSavedDeliveryStatus(ok ? 'available' : 'unavailable');
    localStorage.setItem('milko_delivery_status', ok ? 'available' : 'unavailable');
  }, [savedPincode, serviceablePincodes]);

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
      localStorage.setItem('milko_delivery_pincode', fullPincode);
      localStorage.setItem('milko_delivery_status', 'available');
      setSavedPincode(fullPincode);
      setSavedDeliveryStatus('available');
      setIsAddressModalOpen(false);
    } else if (deliveryStatus === 'unavailable') {
      // Save unavailable status
      localStorage.setItem('milko_delivery_pincode', fullPincode);
      localStorage.setItem('milko_delivery_status', 'unavailable');
      setSavedPincode(fullPincode);
      setSavedDeliveryStatus('unavailable');
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setIsSearching(true);
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      // Reset searching state after navigation (component will unmount anyway, but just in case)
      setTimeout(() => setIsSearching(false), 1000);
    }
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
        className={isAuthPage 
          ? `${styles.header} ${styles.headerTransparent}` 
          : `${styles.header} ${isScrolled ? styles.headerScrolled : ''}`
        }
      >
        {/* First Row: Logo and Icons */}
        <div className={`${styles.headerRow} ${isScrolled ? styles.headerRowScrolled : ''}`}>
          {/* Mobile: Show search bar in headerRow when scrolled */}
          {!isAuthPage && isScrolled && (
            <form onSubmit={handleSearch} className={styles.searchFormMobileSticky}>
              {/* Search Icon */}
              {!isSearching && (
                <div className={styles.searchIcon}>
                  <svg 
                    viewBox="0 -0.5 25 25" 
                    fill="none" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                    <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                      <path 
                        fillRule="evenodd" 
                        clipRule="evenodd" 
                        d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" 
                        stroke="#000000" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      ></path>
                      <path 
                        d="M15.989 15.4905L19.5 19.0015" 
                        stroke="#000000" 
                        strokeWidth="1.5" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                      ></path>
                    </g>
                  </svg>
                </div>
              )}
              <input
                type="text"
                placeholder="Search Dairy products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
                disabled={isSearching}
              />
              {isSearching && (
                <div className={styles.searchSpinner}>
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className={styles.spinnerIcon}
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#000000"
                      strokeWidth="2"
                      strokeOpacity="0.2"
                      fill="none"
                    />
                    <path
                      d="M12 2C6.477 2 2 6.477 2 12"
                      stroke="#000000"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                      strokeDasharray="20 40"
                    />
                  </svg>
                </div>
              )}
            </form>
          )}

          {/* Logo - Hide on mobile when scrolled */}
          <Link href="/" className={`${styles.logo} ${isScrolled ? styles.logoHiddenMobile : ''}`}>
            {isLoading ? (
              <div className={`${styles.logoShimmer} ${styles.shimmer}`}></div>
            ) : (
              <div className={styles.logoText}>
                Milko.in
              </div>
            )}
          </Link>

          {/* Desktop Search Bar - Hide on auth pages */}
          {!isAuthPage ? (
            isLoading ? (
              <div className={`${styles.searchShimmer} ${styles.shimmer}`}></div>
            ) : (
              <form onSubmit={handleSearch} className={styles.searchForm}>
                {/* Search Icon */}
                {!isSearching && (
                  <div className={styles.searchIcon}>
                    <svg 
                      viewBox="0 -0.5 25 25" 
                      fill="none" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                      <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                      <g id="SVGRepo_iconCarrier">
                        <path 
                          fillRule="evenodd" 
                          clipRule="evenodd" 
                          d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" 
                          stroke="#000000" 
                          strokeWidth="1.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        ></path>
                        <path 
                          d="M15.989 15.4905L19.5 19.0015" 
                          stroke="#000000" 
                          strokeWidth="1.5" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        ></path>
                      </g>
                    </svg>
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Search Dairy products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                  disabled={isSearching}
                />
                {isSearching && (
                  <div className={styles.searchSpinner}>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className={styles.spinnerIcon}
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="#000000"
                        strokeWidth="2"
                        strokeOpacity="0.2"
                        fill="none"
                      />
                      <path
                        d="M12 2C6.477 2 2 6.477 2 12"
                        stroke="#000000"
                        strokeWidth="2"
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray="20 40"
                      />
                    </svg>
                  </div>
                )}
              </form>
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
              {/* Deliver To Address - Icon Only on Mobile */}
              <button 
                className={`${styles.iconButton} ${savedDeliveryStatus === 'available' ? styles.deliveryIconAvailable : savedDeliveryStatus === 'unavailable' ? styles.deliveryIconUnavailable : ''}`}
                onClick={() => setIsAddressModalOpen(true)}
                aria-label="Delivery location"
              >
                <svg className={styles.buttonIcon} viewBox="0 0 8.4666669 8.4666669" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <g transform="translate(0,-288.53332)">
                      <path d="m 4.2324219,288.79688 c -1.6042437,0 -2.9101556,1.30591 -2.9101563,2.91015 -10e-7,2.82277 2.7460938,4.96875 2.7460938,4.96875 a 0.26460978,0.26460978 0 0 0 0.3300781,0 c 0,0 2.7460996,-2.14598 2.7460937,-4.96875 -3.4e-6,-1.60424 -1.3078657,-2.91015 -2.9121093,-2.91015 z m 0,0.52929 c 1.3182605,0 2.3828097,1.0626 2.3828125,2.38086 4.8e-6,2.30926 -2.0910618,4.13374 -2.3808594,4.38086 -0.2884142,-0.24588 -2.3828134,-2.0707 -2.3828125,-4.38086 5e-7,-1.31826 1.0625988,-2.38086 2.3808594,-2.38086 z" fill="currentColor"></path>
                      <path d="m 4.2324219,290.38477 c -0.7274912,0 -1.3222633,0.59477 -1.3222657,1.32226 -4.5e-6,0.7275 0.5947697,1.32422 1.3222657,1.32422 0.727496,0 1.3242233,-0.59672 1.3242187,-1.32422 -2.3e-6,-0.72749 -0.5967275,-1.32226 -1.3242187,-1.32226 z m 0,0.52929 c 0.4415089,0 0.7949204,0.35146 0.7949219,0.79297 2.7e-6,0.44151 -0.35341,0.79492 -0.7949219,0.79492 -0.441512,0 -0.7929715,-0.35341 -0.7929688,-0.79492 1.4e-6,-0.44151 0.3514598,-0.79297 0.7929688,-0.79297 z" fill="currentColor"></path>
                    </g>
                  </g>
                </svg>
                <span className={styles.iconButtonText}>Location</span>
              </button>
              
              {/* Desktop Deliver To Address */}
              <div className={styles.deliverTo} onClick={() => setIsAddressModalOpen(true)}>
                <svg className={styles.locationIcon} viewBox="0 0 8.4666669 8.4666669" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <g transform="translate(0,-288.53332)">
                      <path d="m 4.2324219,288.79688 c -1.6042437,0 -2.9101556,1.30591 -2.9101563,2.91015 -10e-7,2.82277 2.7460938,4.96875 2.7460938,4.96875 a 0.26460978,0.26460978 0 0 0 0.3300781,0 c 0,0 2.7460996,-2.14598 2.7460937,-4.96875 -3.4e-6,-1.60424 -1.3078657,-2.91015 -2.9121093,-2.91015 z m 0,0.52929 c 1.3182605,0 2.3828097,1.0626 2.3828125,2.38086 4.8e-6,2.30926 -2.0910618,4.13374 -2.3808594,4.38086 -0.2884142,-0.24588 -2.3828134,-2.0707 -2.3828125,-4.38086 5e-7,-1.31826 1.0625988,-2.38086 2.3808594,-2.38086 z" fill="currentColor"></path>
                      <path d="m 4.2324219,290.38477 c -0.7274912,0 -1.3222633,0.59477 -1.3222657,1.32226 -4.5e-6,0.7275 0.5947697,1.32422 1.3222657,1.32422 0.727496,0 1.3242233,-0.59672 1.3242187,-1.32422 -2.3e-6,-0.72749 -0.5967275,-1.32226 -1.3242187,-1.32226 z m 0,0.52929 c 0.4415089,0 0.7949204,0.35146 0.7949219,0.79297 2.7e-6,0.44151 -0.35341,0.79492 -0.7949219,0.79492 -0.441512,0 -0.7929715,-0.35341 -0.7929688,-0.79492 1.4e-6,-0.44151 0.3514598,-0.79297 0.7929688,-0.79297 z" fill="currentColor"></path>
                    </g>
                  </g>
                </svg>
                <div className={styles.deliverToContent}>
                  {savedPincode && savedDeliveryStatus ? (
                    <>
                      <span className={styles.deliverToLabel}>
                        {savedDeliveryStatus === 'available' ? 'Available:' : 'Not available:'}
                      </span>
                      <span className={styles.deliverToAddress}>{savedPincode}</span>
                    </>
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

      {/* Second Row: Search Bar - Mobile Only (Hide when scrolled, search moves to headerRow) */}
      {!isAuthPage ? (
        <div className={`${styles.searchRow} ${isScrolled ? styles.searchRowHidden : ''}`}>
          {isLoading ? (
            <div className={`${styles.searchShimmer} ${styles.shimmer}`}></div>
          ) : (
            <form onSubmit={handleSearch} className={styles.searchForm}>
            {/* Search Icon */}
            {!isSearching && (
              <div className={styles.searchIcon}>
                <svg 
                  viewBox="0 -0.5 25 25" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0"></g>
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round"></g>
                  <g id="SVGRepo_iconCarrier">
                    <path 
                      fillRule="evenodd" 
                      clipRule="evenodd" 
                      d="M5.5 11.1455C5.49956 8.21437 7.56975 5.69108 10.4445 5.11883C13.3193 4.54659 16.198 6.08477 17.32 8.79267C18.4421 11.5006 17.495 14.624 15.058 16.2528C12.621 17.8815 9.37287 17.562 7.3 15.4895C6.14763 14.3376 5.50014 12.775 5.5 11.1455Z" 
                      stroke="#000000" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    ></path>
                    <path 
                      d="M15.989 15.4905L19.5 19.0015" 
                      stroke="#000000" 
                      strokeWidth="1.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    ></path>
                  </g>
                </svg>
              </div>
            )}
            <input
              type="text"
              placeholder="Search Dairy products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
              disabled={isSearching}
            />
            {isSearching && (
              <div className={styles.searchSpinner}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={styles.spinnerIcon}
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="#000000"
                    strokeWidth="2"
                    strokeOpacity="0.2"
                    fill="none"
                  />
                  <path
                    d="M12 2C6.477 2 2 6.477 2 12"
                    stroke="#000000"
                    strokeWidth="2"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray="20 40"
                  />
                </svg>
              </div>
            )}
          </form>
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
                  <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

            {/* Delivery Status Message */}
            {deliveryStatus && deliveryStatus !== 'checking' && (
              <div className={`${styles.deliveryStatusMessage} ${
                deliveryStatus === 'available' ? styles.deliveryStatusSuccess : styles.deliveryStatusError
              }`}>
                {deliveryStatus === 'available' ? (
                  <>
                    <svg className={styles.statusIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{pincode.join('')} available to deliver</span>
                  </>
                ) : (
                  <>
                    <svg className={styles.statusIcon} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <span>{pincode.join('')} not available to deliver</span>
                  </>
                )}
              </div>
            )}

            {/* Check/Done Button */}
            <button
              className={`${styles.modalDoneButton} ${
                deliveryStatus === 'available' ? styles.modalDoneButtonSuccess :
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
                opacity: (pincode.join('').length === 6 && deliveryStatus !== 'checking') ? 1 : 0.5,
                cursor: (pincode.join('').length === 6 && deliveryStatus !== 'checking') ? 'pointer' : 'not-allowed'
              }}
            >
              {deliveryStatus === 'checking' ? 'Checking...' : 
               deliveryStatus === 'available' || deliveryStatus === 'unavailable' ? 'Done' : 'Check'}
            </button>
          </div>
        </div>
      ) : null}
      </header>

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

