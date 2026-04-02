import type { Metadata } from 'next';
import ProductsClient from './ProductsClient';

export const metadata: Metadata = {
  title: 'Our Products | Milko.in',
  description: 'Shop our fresh dairy products and add them to your cart for delivery.',
  alternates: {
    canonical: '/products',
  },
  openGraph: {
    title: 'Our Products | Milko.in',
    description: 'Shop our fresh dairy products and add them to your cart for delivery.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Our Products | Milko.in',
    description: 'Shop our fresh dairy products and add them to your cart for delivery.',
  },
};

export default function ProductsPage() {
  return <ProductsClient />;
}

