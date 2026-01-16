'use client';

import { useEffect, useState } from 'react';
import { adminContentApi, SiteContent } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './content.module.css';

const CONTENT_TYPES = [
  { type: 'terms', label: 'Terms & Conditions', icon: '📄', path: '/terms' },
  { type: 'privacy', label: 'Privacy Policy', icon: '🔒', path: '/privacy' },
  { type: 'about', label: 'About Us', icon: 'ℹ️', path: '/about' },
  { type: 'contact', label: 'Contact Details', icon: '📞', path: '/contact' },
  { type: 'reviews', label: 'Reviews Settings', icon: '⭐', path: '/reviews' },
];

const OTHER_OPTIONS = [
  { type: 'categories', label: 'Product Categories', icon: '🏷️', path: '/admin/categories' },
];

/**
 * Admin Content Management Page
 * Manage all site content (Terms, Privacy, About, Contact, Reviews)
 */
export default function AdminContentPage() {
  const router = useRouter();
  const [contentList, setContentList] = useState<SiteContent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const data = await adminContentApi.getAll();
      setContentList(data);
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (type: string) => {
    router.push(`/admin/content/${type}`);
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
        <LoadingSpinnerWithText text="Loading content..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={adminStyles.adminPageTitle}>Manage Site Content & Settings</h1>

      <div className={styles.contentGrid}>
        {CONTENT_TYPES.map((contentType) => {
          const content = contentList.find(c => c.contentType === contentType.type);
          const isActive = content?.isActive ?? false;
          const lastUpdated = content?.updatedAt 
            ? new Date(content.updatedAt).toLocaleDateString()
            : 'Never';

          return (
            <div key={contentType.type} className={styles.contentCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIcon}>{contentType.icon}</div>
                <div>
                  <h3 className={styles.cardTitle}>{contentType.label}</h3>
                  <div className={styles.cardMeta}>
                    <span className={isActive ? styles.activeBadge : styles.inactiveBadge}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className={styles.lastUpdated}>Updated: {lastUpdated}</span>
                  </div>
                </div>
              </div>
              <div className={styles.cardActions}>
                <button
                  onClick={() => handleEdit(contentType.type)}
                  className={styles.editButton}
                >
                  Edit
                </button>
                <a
                  href={contentType.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.viewButton}
                >
                  View
                </a>
              </div>
            </div>
          );
        })}
        {OTHER_OPTIONS.map((option) => (
          <div key={option.type} className={styles.contentCard}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>{option.icon}</div>
              <div>
                <h3 className={styles.cardTitle}>{option.label}</h3>
                <div className={styles.cardMeta}>
                  <span className={styles.lastUpdated}>Manage product categories</span>
                </div>
              </div>
            </div>
            <div className={styles.cardActions}>
              <button
                onClick={() => router.push(option.path)}
                className={styles.editButton}
              >
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
