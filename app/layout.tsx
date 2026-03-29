import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import localFont from 'next/font/local';
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

const cabinetGrotesk = localFont({
  src: [
    {
      path: '../fonts/CabinetGrotesk-Light.woff2',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../fonts/CabinetGrotesk-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../fonts/CabinetGrotesk-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../fonts/CabinetGrotesk-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../fonts/CabinetGrotesk-Extrabold.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../fonts/CabinetGrotesk-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-cabinet-grotesk',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Milko.in - Fresh Milk Delivery',
  description: 'Daily milk delivery subscription service',
};

export const viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cabinetGrotesk.variable} suppressHydrationWarning>
      <body className={cabinetGrotesk.className}>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <Suspense fallback={null}>
                <OAuthErrorHandler />
              </Suspense>
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

