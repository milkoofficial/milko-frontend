'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { bannersApi, Banner as BannerType } from '@/lib/api';
import styles from './Banner.module.css';

interface BannerProps {
  autoSlideInterval?: number; // in milliseconds
}

/**
 * Banner Component
 * Sliding banner/carousel with auto-play functionality
 * Fetches banners from API
 * Supports separate mobile/desktop images and adaptive height
 */
export default function Banner({ autoSlideInterval = 5000 }: BannerProps) {
  const pathname = usePathname();
  const [banners, setBanners] = useState<BannerType[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  const firstImageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const data = await bannersApi.getAll();
        setBanners(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch banners:', error);
        setLoading(false);
      }
    };

    fetchBanners();
  }, []);

  // Detect mobile device - check immediately and on resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    // Check immediately
    if (typeof window !== 'undefined') {
      checkMobile();
      window.addEventListener('resize', checkMobile);
      return () => window.removeEventListener('resize', checkMobile);
    }
  }, []);

  // Adapt to first image height if enabled
  useEffect(() => {
    if (banners.length === 0 || !firstImageRef.current) return;
    
    const firstBanner = banners[0];
    if (firstBanner.adaptToFirstImage) {
      const img = new Image();
      const imageUrl = isMobile && firstBanner.mobileImageUrl 
        ? firstBanner.mobileImageUrl 
        : firstBanner.imageUrl;
      
      img.onload = () => {
        // Calculate height based on image aspect ratio
        const aspectRatio = img.height / img.width;
        const containerWidth = firstImageRef.current?.parentElement?.clientWidth || window.innerWidth;
        const calculatedHeight = containerWidth * aspectRatio;
        setContainerHeight(calculatedHeight);
      };
      
      img.src = imageUrl;
    } else {
      setContainerHeight(null);
    }
  }, [banners, isMobile]);

  useEffect(() => {
    if (banners.length === 0) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % banners.length);
    }, autoSlideInterval);

    return () => clearInterval(interval);
  }, [banners.length, autoSlideInterval]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + banners.length) % banners.length);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % banners.length);
  };

  // Hide banner on mobile for cart page
  const shouldHideOnMobile = pathname === '/cart' && isMobile;

  // Don't render if loading or no banners
  if (loading) {
    return null;
  }

  if (banners.length === 0) {
    return null;
  }

  // Determine which image to show based on device
  const getImageUrl = (banner: BannerType) => {
    if (isMobile && banner.mobileImageUrl) {
      return banner.mobileImageUrl;
    }
    return banner.imageUrl;
  };

  return (
    <div className={`${styles.bannerOuter} ${pathname === '/cart' ? styles.hideOnMobile : ''}`}>
      <div
        className={styles.bannerContainer}
        style={containerHeight ? { height: `${containerHeight}px` } : undefined}
      >
        <div className={styles.bannerWrapper}>
        {banners.map((banner, index) => {
          const BannerWrapper = banner.link ? 'a' : 'div';
          const wrapperProps = banner.link 
            ? { 
                href: banner.link,
                target: banner.link.startsWith('http') ? '_blank' : '_self',
                rel: banner.link.startsWith('http') ? 'noopener noreferrer' : undefined,
                style: { textDecoration: 'none', display: 'block', width: '100%', height: '100%' }
              }
            : {};
          
          const imageUrl = getImageUrl(banner);
          const isFirstSlide = index === 0;
          
          return (
            <BannerWrapper
              key={banner.id}
              {...wrapperProps}
            >
              <div
                ref={isFirstSlide ? firstImageRef : null}
                className={`${styles.bannerSlide} ${index === currentSlide ? styles.active : ''} ${banner.link ? styles.clickable : ''}`}
                style={{
                  backgroundImage: imageUrl ? `url(${imageUrl})` : 'none',
                  backgroundColor: '#f5f5f5',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div className={styles.bannerContent}>
                  {banner.title && <h2 className={styles.bannerTitle}>{banner.title}</h2>}
                  {banner.description && <p className={styles.bannerDescription}>{banner.description}</p>}
                </div>
              </div>
            </BannerWrapper>
          );
        })}
      </div>

      {/* Navigation Arrows */}
      <button
        className={styles.navButton}
        onClick={goToPrevious}
        aria-label="Previous slide"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <button
        className={`${styles.navButton} ${styles.navButtonRight}`}
        onClick={goToNext}
        aria-label="Next slide"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

        {/* Dots Indicator */}
        <div className={styles.dotsContainer}>
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              className={`${styles.dot} ${index === currentSlide ? styles.dotActive : ''}`}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

