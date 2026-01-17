'use client';

import { useEffect, useState } from 'react';
import { adminContentApi, SiteContent } from '@/lib/api';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './content.module.css';

const CONTENT_TYPES = [
  { type: 'terms', label: 'Terms & Conditions', path: '/terms' },
  { type: 'privacy', label: 'Privacy Policy', path: '/privacy' },
  { type: 'about', label: 'About Us', path: '/about' },
  { type: 'contact', label: 'Contact Details', path: '/contact' },
  { type: 'reviews', label: 'Reviews Settings', path: '/reviews' },
  { type: 'pincodes', label: 'Pincodes', path: '' },
];

const OTHER_OPTIONS = [
  { type: 'categories', label: 'Product Categories', path: '/admin/categories' },
];

function Icon({ name }: { name: string }) {
  // Minimal monochrome icons (Heroicons-ish). Keep them inline to avoid new deps.
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'terms':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M7 3h7l3 3v15a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
          <path d="M14 3v4a2 2 0 0 0 2 2h4" />
          <path d="M8 13h8M8 17h8M8 9h4" />
        </svg>
      );
    case 'privacy':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3 20 7v6c0 5-3.5 9-8 9s-8-4-8-9V7l8-4Z" />
          <path d="M9.5 12.5a2.5 2.5 0 0 1 5 0V16h-5v-3.5Z" />
          <path d="M10 16h4" />
        </svg>
      );
    case 'about':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10v6" />
          <path d="M12 7h.01" />
        </svg>
      );
    case 'contact':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3 5.18 2 2 0 0 1 5 3h3a2 2 0 0 1 2 1.72c.12.86.33 1.7.62 2.5a2 2 0 0 1-.45 2.11L9.1 10.9a16 16 0 0 0 4 4l1.57-1.07a2 2 0 0 1 2.11-.45c.8.29 1.64.5 2.5.62A2 2 0 0 1 22 16.92Z" />
        </svg>
      );
    case 'reviews':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27Z" />
        </svg>
      );
    case 'pincodes':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Z" />
          <circle cx="12" cy="10" r="2.5" />
        </svg>
      );
    case 'categories':
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
          <path d="M7 16v2a2 2 0 0 0 2 2h9" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" {...common}>
          <path d="M12 3v18M3 12h18" />
        </svg>
      );
  }
}

function IconBadge({ type }: { type: string }) {
  return (
    <div className={styles.cardIcon} aria-hidden="true">
      <Icon name={type} />
    </div>
  );
}

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
        <LoadingSpinner />
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
                <IconBadge type={contentType.type} />
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
                {contentType.path ? (
                  <a
                    href={contentType.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.viewButton}
                  >
                    View
                  </a>
                ) : null}
              </div>
            </div>
          );
        })}
        {OTHER_OPTIONS.map((option) => (
          <div key={option.type} className={styles.contentCard}>
            <div className={styles.cardHeader}>
              <IconBadge type={option.type} />
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
