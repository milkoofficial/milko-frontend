import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { CheckoutStepProvider } from '@/contexts/CheckoutStepContext';
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
              <CheckoutStepProvider>
                <Suspense fallback={null}>
                  <OAuthErrorHandler />
                </Suspense>
                <ConditionalHeader />
                {children}
                <ConditionalFooter />
                <Toast />
              </CheckoutStepProvider>
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

