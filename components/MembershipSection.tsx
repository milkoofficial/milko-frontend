'use client';

import { useState, useEffect } from 'react';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import styles from './MembershipSection.module.css';
import Select from '@/components/ui/Select';

/**
 * Membership Section Component
 * Shows membership subscription form with dropdowns
 * - Product selection
 * - Liters per day
 * - Duration (days)
 * - Calculated amount
 * - Buy button
 */
export default function MembershipSection() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [litersPerDay, setLitersPerDay] = useState<string>('1');
  const [durationDays, setDurationDays] = useState<string>('30');
  const [loading, setLoading] = useState(true);

  // Fallback demo products
  const fallbackProducts: Product[] = [
    {
      id: '1',
      name: 'Fresh Cow Milk',
      description: 'Pure, fresh cow milk delivered daily',
      pricePerLitre: 60,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Buffalo Milk',
      description: 'Rich and creamy buffalo milk',
      pricePerLitre: 70,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Toned Milk',
      description: 'Light and healthy toned milk',
      pricePerLitre: 55,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '4',
      name: 'Full Cream Milk',
      description: 'Premium full cream milk',
      pricePerLitre: 65,
      imageUrl: undefined,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  useEffect(() => {
    const fetchProducts = async () => {
      // Set a timeout to show fallback products if API takes too long
      const timeoutId = setTimeout(() => {
        setProducts(fallbackProducts);
        setSelectedProduct(fallbackProducts[0].id);
        setLoading(false);
      }, 2000); // 2 second timeout

      try {
        const data = await productsApi.getAll();
        clearTimeout(timeoutId);
        if (data && data.length > 0) {
          setProducts(data);
          setSelectedProduct(data[0].id);
        } else {
          setProducts(fallbackProducts);
          setSelectedProduct(fallbackProducts[0].id);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Failed to fetch products:', error);
        // Use fallback products if API fails
        setProducts(fallbackProducts);
        setSelectedProduct(fallbackProducts[0].id);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Calculate total amount
  const selectedProductData = products.find(p => p.id === selectedProduct);
  const totalAmount = selectedProductData
    ? parseFloat(litersPerDay) * parseFloat(durationDays) * selectedProductData.pricePerLitre
    : 0;

  const formatINR = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const handleBuy = () => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (!selectedProduct || !litersPerDay || !durationDays) {
      alert('Please fill in all fields');
      return;
    }

    // Convert days to months (approximate - 30 days = 1 month)
    const days = parseInt(durationDays);
    const months = Math.ceil(days / 30);

    // Navigate to subscribe page with pre-filled data
    router.push(`/subscribe?productId=${selectedProduct}&liters=${litersPerDay}&days=${durationDays}&months=${months}`);
  };

  if (loading) {
    return (
      <div className={styles.membershipSection}>
        <div className={styles.container}>
          <div className={styles.loading}>Loading membership options...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.membershipSection}>
      <div className={styles.container}>
        <h2 className={styles.sectionTitle}>Become a Member to Daily Delivery</h2>
        <p className={styles.sectionSubtitle}>Get fresh milk delivered to your doorstep daily</p>
        
        <div className={styles.twoColumnLayout}>
          {/* Left Column - Benefits */}
          <div className={styles.benefitsColumn}>
            <h3 className={styles.benefitsTitle}>Why Choose Our Membership?</h3>
            <ul className={styles.benefitsList}>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Fresh, home-handled milk delivered daily.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Zero adulteration — no water, chemicals, or preservatives.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Daily quality checks before delivery.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M20 6L9 17l-5-5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <span className={styles.benefitText}>Priority delivery and assured supply for members.</span>
              </li>
              <li className={styles.benefitItem}>
                <span className={styles.benefitIcon}>💰</span>
                <span className={styles.benefitText}>Adulteration proven? ₹5,100 paid to the customer.</span>
              </li>
            </ul>
          </div>

          {/* Right Column - Membership Card */}
          <div className={styles.membershipCard}>
          <div className={styles.formFields}>
            {/* Product Selection */}
            <div className={styles.formField}>
              <label className={styles.label}>Select Product</label>
              <Select
                className={styles.select}
                value={selectedProduct}
                onChange={setSelectedProduct}
                options={products.map((product) => ({
                  value: product.id,
                  label: `${product.name} - ₹${product.pricePerLitre}/litre`,
                }))}
              />
            </div>

            {/* Liters Per Day */}
            <div className={styles.formField}>
              <label className={styles.label}>Liters Per Day</label>
              <Select
                className={styles.select}
                value={litersPerDay}
                onChange={setLitersPerDay}
                options={[
                  { value: '0.5', label: '0.5 Liters' },
                  { value: '1', label: '1 Liter' },
                  { value: '2', label: '2 Liters' },
                  { value: '3', label: '3 Liters' },
                  { value: '4', label: '4 Liters' },
                  { value: '5', label: '5 Liters' },
                ]}
              />
            </div>

            {/* Duration (Days) */}
            <div className={styles.formField}>
              <label className={styles.label}>Duration</label>
              <Select
                className={styles.select}
                value={durationDays}
                onChange={setDurationDays}
                options={[
                  { value: '7', label: '7 Days (1 Week)' },
                  { value: '15', label: '15 Days' },
                  { value: '30', label: '30 Days (1 Month)' },
                  { value: '60', label: '60 Days (2 Months)' },
                  { value: '90', label: '90 Days (3 Months)' },
                  { value: '180', label: '180 Days (6 Months)' },
                  { value: '365', label: '365 Days (1 Year)' },
                ]}
              />
            </div>
          </div>

          {/* Amount Display */}
          <div className={styles.amountSection}>
            <div className={styles.amountLabel}>Total Amount</div>
            <div className={styles.amountValue}>
              ₹{formatINR(totalAmount)}
            </div>
            {selectedProductData && (
              <div className={styles.amountBreakdown}>
                {litersPerDay}L/day × {durationDays} days × ₹{formatINR(selectedProductData.pricePerLitre)}/L
              </div>
            )}
          </div>

          {/* Buy Button */}
          <button
            className={styles.buyButton}
            onClick={handleBuy}
            disabled={!selectedProduct || totalAmount === 0}
          >
            {isAuthenticated ? 'Subscribe Now' : 'Login to Subscribe'}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

