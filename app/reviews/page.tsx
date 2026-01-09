'use client';

import { useEffect, useState } from 'react';
import { contentApi, SiteContent } from '@/lib/api';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import styles from '../terms/page.module.css';

/**
 * Reviews Page
 * Displays reviews settings and information
 */
export default function ReviewsPage() {
  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await contentApi.getByType('reviews');
      setContent(data);
    } catch (error) {
      console.error('Failed to fetch reviews info:', error);
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
        <h1>Reviews</h1>
        <p>Content not available.</p>
      </div>
    );
  }

  const metadata = content.metadata || {};

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{content.title}</h1>
      
      {content.content && (
        <div 
          className={styles.content}
          dangerouslySetInnerHTML={{ __html: content.content.replace(/\n/g, '<br />') }}
        />
      )}

      <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f9f9f9', borderRadius: '8px' }}>
        <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>Review Settings</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <strong>Public Reviews:</strong> {metadata.allowPublicReviews ? 'Enabled' : 'Disabled'}
          </div>
          <div>
            <strong>Admin Approval Required:</strong> {metadata.requireApproval ? 'Yes' : 'No'}
          </div>
        </div>
      </div>
    </div>
  );
}
