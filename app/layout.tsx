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
import Toast from '@/components/Toast';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
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
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={inter.className}>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <Suspense fallback={null}>
                <OAuthErrorHandler />
              </Suspense>
              <ConditionalHeader />
              {children}
              <ConditionalFooter />
              <Toast />
              <SpeedInsights />
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

