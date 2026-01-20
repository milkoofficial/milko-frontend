'use client';

import Link from 'next/link';
import Logo from './Logo';
import styles from './Footer.module.css';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerContent}>
          {/* Company Info */}
          <div className={styles.footerSection}>
            <Link href="/" className={styles.logo}>
              <Logo textClassName={styles.logoText} imageClassName={styles.logoImg} />
            </Link>
            <p className={styles.description}>
              Fresh milk delivered daily to your doorstep. 
              Quality you can trust, convenience you deserve.
            </p>
          </div>

          {/* Quick Links */}
          <div className={styles.footerSection}>
            <h3 className={styles.sectionTitle}>Quick Links</h3>
            <ul className={styles.linksList}>
              <li>
                <Link href="/products">Products</Link>
              </li>
              <li>
                <Link href="/#membership">Subscription</Link>
              </li>
              <li>
                <Link href="/about">About Us</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className={styles.footerSection}>
            <h3 className={styles.sectionTitle}>Customer Service</h3>
            <ul className={styles.linksList}>
              <li>
                <Link href="/dashboard">My Account</Link>
              </li>
              <li>
                <Link href="/subscriptions">My Subscriptions</Link>
              </li>
              <li>
                <Link href="/orders">Orders</Link>
              </li>
              <li>
                <Link href="/cart">Cart</Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className={styles.footerSection}>
            <h3 className={styles.sectionTitle}>Legal</h3>
            <ul className={styles.linksList}>
              <li>
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms">Terms & Conditions</Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className={styles.copyright}>
          <p>© {currentYear} Milko.in. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
