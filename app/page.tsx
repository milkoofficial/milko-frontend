import Banner from '@/components/Banner';
import ProductsSection from '@/components/ProductsSection';
import MembershipSection from '@/components/MembershipSection';

export const metadata = {
  title: 'Milko.in - Fresh Milk Delivery & Subscriptions',
  description:
    'Daily fresh milk delivery and subscription plans. Explore products and become a subscriber for convenient doorstep service.',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Milko.in - Fresh Milk Delivery & Subscriptions',
    description:
      'Daily fresh milk delivery and subscription plans. Explore products and become a subscriber for convenient doorstep service.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Milko.in - Fresh Milk Delivery & Subscriptions',
    description:
      'Daily fresh milk delivery and subscription plans. Explore products and become a subscriber for convenient doorstep service.',
  },
};

/**
 * Home Page
 * Shows banner, products, and membership subscription
 */
export default function HomePage() {
  return (
    <div>
      {/* Banner */}
      <Banner />
      
      {/* Products Section */}
      <ProductsSection />

      {/* Membership Section */}
      <MembershipSection />
    </div>
  );
}

