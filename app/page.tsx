import Banner from '@/components/Banner';
import ProductsSection from '@/components/ProductsSection';
import MembershipSection from '@/components/MembershipSection';
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/seo';

export const metadata = {
  title: 'Fresh Milk Delivery & Subscriptions',
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: `${SITE_NAME} | Fresh Milk Delivery & Subscriptions`,
    description: SITE_DESCRIPTION,
    type: 'website',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} | Fresh Milk Delivery & Subscriptions`,
    description: SITE_DESCRIPTION,
  },
};

/**
 * Home Page
 * Shows banner, products, and membership subscription
 */
export default function HomePage() {
  const structuredData = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${absoluteUrl('/search')}?q={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      areaServed: 'India',
      sameAs: [SITE_URL],
    },
  ];

  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {/* Banner */}
      <Banner />
      
      {/* Products Section */}
      <ProductsSection />

      {/* Membership Section */}
      <MembershipSection />
    </div>
  );
}

