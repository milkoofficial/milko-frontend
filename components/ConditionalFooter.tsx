'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Footer from './Footer';
import styles from './ConditionalFooter.module.css';
import { useCheckoutStep } from '@/contexts/CheckoutStepContext';

/**
 * Conditional Footer Component
 * Hides footer on auth pages and admin panel
 * Hides footer on cart page for mobile devices
 * Hides footer on checkout step 2 (address) for mobile devices only
 */
export default function ConditionalFooter() {
  const pathname = usePathname();
  const { checkoutStep } = useCheckoutStep();
  const [isMobile, setIsMobile] = useState(false);

  const isAuthRoute = pathname?.startsWith('/auth');
  const isAdminRoute = pathname?.startsWith('/admin');
  const isCartPage = pathname === '/cart';
  const isCheckoutAddressStep = pathname === '/checkout' && checkoutStep === 'address' && isMobile;

  useEffect(() => {
    const check = () => setIsMobile(typeof window !== 'undefined' && window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isAuthRoute || isAdminRoute) {
    return null;
  }

  if (isCheckoutAddressStep) {
    return null;
  }

  return (
    <div className={isCartPage ? styles.hideOnMobile : ''}>
      <Footer />
    </div>
  );
}
