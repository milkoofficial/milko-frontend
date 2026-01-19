'use client';

import { useEffect, useState } from 'react';
import { contentApi, SiteContent } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import MobileBackToAccount from '@/components/MobileBackToAccount';
import styles from './page.module.css';

/**
 * Contact Us Page
 */
export default function ContactPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await contentApi.getByType('contact');
      setContent(data);
    } catch (error) {
      console.error('Failed to fetch contact info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading..." />
      </div>
    );
  }

  if (!content) {
    return (
      <div className={styles.container}>
        <MobileBackToAccount />
        <h1>Contact Us</h1>
        <p>Contact information not available.</p>
      </div>
    );
  }

  const metadata = content.metadata || {};

  return (
    <div className={styles.container}>
      <MobileBackToAccount />
      <h1 className={styles.title}>{content.title}</h1>
      
      <div className={styles.contactInfo}>
        {metadata.email && (
          <div className={styles.contactItem}>
            <div className={styles.contactIcon}>📧</div>
            <div>
              <div className={styles.contactLabel}>Email</div>
              <a href={`mailto:${metadata.email}`} className={styles.contactValue}>
                {metadata.email}
              </a>
            </div>
          </div>
        )}

        {metadata.phone && (
          <div className={styles.contactItem}>
            <div className={styles.contactIcon}>📞</div>
            <div>
              <div className={styles.contactLabel}>Phone</div>
              <a href={`tel:${metadata.phone}`} className={styles.contactValue}>
                {metadata.phone}
              </a>
            </div>
          </div>
        )}

        {metadata.address && (
          <div className={styles.contactItem}>
            <div className={styles.contactIcon}>📍</div>
            <div>
              <div className={styles.contactLabel}>Address</div>
              <div className={styles.contactValue}>{metadata.address}</div>
            </div>
          </div>
        )}
      </div>

      {content.content && (
        <div 
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: content.content.replace(/\n/g, '<br />') }}
        />
      )}
    </div>
  );
}
