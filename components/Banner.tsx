'use client';

import { useState, useEffect } from 'react';
import { bannersApi, Banner as BannerType } from '@/lib/api';
import styles from './Banner.module.css';

interface BannerProps {
  autoSlideInterval?: number; // in milliseconds
}

/**
 * Banner Component
 * Sliding banner/carousel with auto-play functionality
 * Fetches banners from API
 */
export default function Banner({ autoSlideInterval = 5000 }: BannerProps) {
  const [banners, setBanners] = useState<BannerType[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);

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

  // Don't render if loading or no banners
  if (loading) {
    return null;
  }

  if (banners.length === 0) {
    return null;
  }

  return (
    <div className={styles.bannerContainer}>
      <div className={styles.bannerWrapper}>
        {banners.map((banner, index) => (
          <div
            key={banner.id}
            className={`${styles.bannerSlide} ${index === currentSlide ? styles.active : ''}`}
            style={{
              backgroundImage: banner.imageUrl ? `url(${banner.imageUrl})` : 'none',
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
        ))}
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
  );
}

