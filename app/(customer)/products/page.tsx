import type { Metadata } from 'next';
import ProductsClient from './ProductsClient';
import { absoluteUrl } from '@/lib/seo';

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
    url: '/products',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Our Products | Milko.in',
    description: 'Shop our fresh dairy products and add them to your cart for delivery.',
  },
};

export default function ProductsPage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'Our Products | Milko.in',
      url: absoluteUrl('/products'),
      description: 'Shop our fresh dairy products and add them to your cart for delivery.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: absoluteUrl('/'),
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Products',
          item: absoluteUrl('/products'),
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <ProductsClient />
    </>
  );
}

