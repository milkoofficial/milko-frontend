import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
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
import FaviconManager from '@/components/FaviconManager';
import { DEFAULT_KEYWORDS, SITE_DESCRIPTION, SITE_NAME, getSiteUrl } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

function metadataBaseUrl(): URL {
  return getSiteUrl();
}

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} | Fresh Milk Delivery`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  metadataBase: metadataBaseUrl(),
  keywords: DEFAULT_KEYWORDS,
  applicationName: SITE_NAME,
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: '/',
    title: `${SITE_NAME} | Fresh Milk Delivery`,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Fresh Milk Delivery`,
    description: SITE_DESCRIPTION,
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
              <FaviconManager />
              <NativeGoogleBridge />
              <ConditionalHeader />
              {children}
              <ConditionalFooter />
              <MobileBottomNav />
              <Toast />
              <Analytics />
              <SpeedInsights />
              <GoogleAnalytics measurementId={process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

