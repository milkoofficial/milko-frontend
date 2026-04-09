import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Inter } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ToastProvider } from '@/contexts/ToastContext';
import OAuthErrorHandler from '@/components/OAuthErrorHandler';
import Header from '@/components/Header';
import AdminHeader from '@/components/AdminHeader';
import ConditionalHeader from '@/components/ConditionalHeader';
import ConditionalFooter from '@/components/ConditionalFooter';
import MobileBottomNav from '@/components/MobileBottomNav';
import Toast from '@/components/Toast';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import NativeGoogleBridge from '@/components/NativeGoogleBridge';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

function metadataBaseUrl(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) {
    try {
      return new URL(raw);
    } catch {
      /* invalid URL in env would crash the app */
    }
  }
  return new URL('http://localhost:3000');
}

export const metadata: Metadata = {
  title: 'Milko.in - Fresh Milk Delivery',
  description: 'Daily milk delivery subscription service',
  metadataBase: metadataBaseUrl(),
  openGraph: {
    type: 'website',
    siteName: 'Milko.in',
  },
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <Suspense fallback={null}>
                <OAuthErrorHandler />
              </Suspense>
              <NativeGoogleBridge />
              <ConditionalHeader />
              {children}
              <ConditionalFooter />
              <MobileBottomNav />
              <Toast />
              <SpeedInsights />
              <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

