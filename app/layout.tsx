import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { ToastProvider } from '@/contexts/ToastContext';
import Header from '@/components/Header';
import AdminHeader from '@/components/AdminHeader';
import ConditionalHeader from '@/components/ConditionalHeader';
import Footer from '@/components/Footer';
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <ConditionalHeader />
              {children}
              <Footer />
              <Toast />
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

