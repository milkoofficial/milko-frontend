import Banner from '@/components/Banner';
import ProductsSection from '@/components/ProductsSection';
import MembershipSection from '@/components/MembershipSection';

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

