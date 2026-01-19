'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminContentApi, SiteContent } from '@/lib/api';
import LoadingSpinner, { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import RichTextEditor from '@/components/ui/RichTextEditor';
import adminStyles from '../../admin-styles.module.css';
import styles from './edit.module.css';

const CONTENT_TYPE_LABELS: Record<string, string> = {
  terms: 'Terms & Conditions',
  privacy: 'Privacy Policy',
  about: 'About Us',
  contact: 'Contact Details',
  reviews: 'Reviews Settings',
  pincodes: 'Pincodes',
};

/**
 * Admin Content Edit Page
 * Edit specific content type
 */
export default function AdminContentEditPage() {
  const params = useParams();
  const router = useRouter();
  const contentType = params.type as string;

  const [content, setContent] = useState<SiteContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [contentText, setContentText] = useState('');
  const [metadata, setMetadata] = useState<Record<string, any>>({});
  const [isActive, setIsActive] = useState(true);
  const [serviceablePincodes, setServiceablePincodes] = useState<Array<{ pincode: string; deliveryTime: string }>>([]);
  const [newPincodeInput, setNewPincodeInput] = useState('');
  const [newDeliveryTimeInput, setNewDeliveryTimeInput] = useState('1h');

  useEffect(() => {
    fetchContent();
  }, [contentType]);

  const fetchContent = async () => {
    try {
      setLoading(true);
      const data = await adminContentApi.getByType(contentType);
      setContent(data);
      setTitle(data.title);
      setContentText(data.content);
      setMetadata(data.metadata || {});
      setIsActive(data.isActive);
      if (contentType === 'pincodes') {
        // Support: {pincode, deliveryTime}[], legacy string[], or single string
        const meta = data.metadata || {};
        let list: Array<{ pincode: string; deliveryTime: string }> = [];
        if (Array.isArray(meta.serviceablePincodes)) {
          list = meta.serviceablePincodes.map((el: any) =>
            typeof el === 'string'
              ? { pincode: el.trim(), deliveryTime: '1h' }
              : { pincode: (el.pincode || el).toString().trim(), deliveryTime: (el.deliveryTime || '1h').toString().trim() || '1h' }
          ).filter((x) => x.pincode.length === 6);
        } else if (typeof meta.serviceablePincode === 'string' && meta.serviceablePincode.trim()) {
          list = [{ pincode: meta.serviceablePincode.trim(), deliveryTime: '1h' }];
        }
        setServiceablePincodes(list);
      }
    } catch (error: any) {
      console.error('Failed to fetch content:', error);
      // If this content type doesn't exist yet, allow creating it from the UI
      if (contentType === 'pincodes') {
        setError('');
        setContent(null);
        setTitle('Pincode Settings');
        setContentText('Delivery pincode settings');
        setMetadata({ serviceablePincodes: [] });
        setServiceablePincodes([] as Array<{ pincode: string; deliveryTime: string }>);
        setIsActive(true);
      } else {
        setError(error.message || 'Failed to load content');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      let finalMetadata = { ...metadata };

      // Handle contact-specific fields
      if (contentType === 'contact') {
        finalMetadata = {
          email: metadata.email || '',
          phone: metadata.phone || '',
          address: metadata.address || '',
        };
      }

      // Handle reviews-specific fields
      if (contentType === 'reviews') {
        finalMetadata = {
          allowPublicReviews: metadata.allowPublicReviews ?? true,
          requireApproval: metadata.requireApproval ?? true,
        };
      }

      // Handle pincodes (multiple serviceable pincodes with delivery time)
      if (contentType === 'pincodes') {
        const invalid = serviceablePincodes.filter((x) => !/^\d{6}$/.test(x.pincode));
        if (invalid.length > 0) {
          setError('All pincodes must be exactly 6 digits. Please check and fix invalid pincodes.');
          return;
        }
        const withTime = serviceablePincodes
          .filter((x) => x.pincode.trim().length > 0)
          .map((x) => ({ pincode: x.pincode.trim(), deliveryTime: (x.deliveryTime || '1h').toString().trim() || '1h' }));
        finalMetadata = { serviceablePincodes: withTime };
      }

      await adminContentApi.update(contentType, {
        title: contentType === 'pincodes' ? 'Pincode Settings' : title,
        content: contentType === 'pincodes' ? 'Delivery pincode settings' : contentText,
        metadata: finalMetadata,
      });

      alert('Content saved successfully!');
      router.push('/admin/content');
    } catch (error: any) {
      console.error('Failed to save content:', error);
      setError(error.message || 'Failed to save content');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    try {
      const updated = await adminContentApi.toggleStatus(contentType, !isActive);
      setIsActive(updated.isActive);
      alert(`Content ${updated.isActive ? 'activated' : 'deactivated'} successfully!`);
    } catch (error: any) {
      console.error('Failed to toggle status:', error);
      alert('Failed to update status');
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
        <LoadingSpinnerWithText text="Loading content..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={adminStyles.adminPageTitle}>
          Edit {CONTENT_TYPE_LABELS[contentType] || contentType}
        </h1>
      </div>

      {error && (
        <div className={styles.errorMessage}>{error}</div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        {contentType !== 'pincodes' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={styles.input}
              disabled={contentType === 'contact' || contentType === 'reviews'}
            />
          </div>
        )}

        {contentType === 'contact' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              value={metadata.email || ''}
              onChange={(e) => setMetadata({ ...metadata, email: e.target.value })}
              className={styles.input}
            />
          </div>
        )}

        {contentType === 'contact' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Phone</label>
            <input
              type="tel"
              value={metadata.phone || ''}
              onChange={(e) => setMetadata({ ...metadata, phone: e.target.value })}
              className={styles.input}
            />
          </div>
        )}

        {contentType === 'contact' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Address</label>
            <textarea
              value={metadata.address || ''}
              onChange={(e) => setMetadata({ ...metadata, address: e.target.value })}
              rows={4}
              className={styles.textarea}
            />
          </div>
        )}

        {contentType === 'reviews' && (
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={metadata.allowPublicReviews ?? true}
                onChange={(e) => setMetadata({ ...metadata, allowPublicReviews: e.target.checked })}
                className={styles.checkbox}
              />
              Allow Public Reviews
            </label>
          </div>
        )}

        {contentType === 'reviews' && (
          <div className={styles.formGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={metadata.requireApproval ?? true}
                onChange={(e) => setMetadata({ ...metadata, requireApproval: e.target.checked })}
                className={styles.checkbox}
              />
              Require Admin Approval
            </label>
          </div>
        )}

        {contentType === 'pincodes' ? (
          <div className={styles.formGroup}>
            <label className={styles.label}>Serviceable Pincodes (6 digits) + Delivery time</label>
            
            {/* List of added pincodes with delivery time */}
            {serviceablePincodes.length > 0 && (
              <div className={styles.pincodeList}>
                {serviceablePincodes.map((item, index) => (
                  <div key={index} className={styles.pincodeItem}>
                    <span className={styles.pincodeValue}>{item.pincode}</span>
                    <input
                      type="text"
                      value={item.deliveryTime}
                      onChange={(e) => {
                        const next = [...serviceablePincodes];
                        next[index] = { ...next[index], deliveryTime: e.target.value };
                        setServiceablePincodes(next);
                      }}
                      className={styles.deliveryTimeInput}
                      placeholder="e.g. 1h, 2h, 15m"
                      title="How much time for delivery (e.g. 1h, 2h, 15m, 30min)"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setServiceablePincodes(serviceablePincodes.filter((_, i) => i !== index));
                      }}
                      className={styles.removePincodeButton}
                      aria-label={`Remove pincode ${item.pincode}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new pincode + delivery time */}
            <div className={styles.addPincodeRow}>
              <input
                type="text"
                inputMode="numeric"
                value={newPincodeInput}
                onChange={(e) => setNewPincodeInput(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                className={styles.input}
                placeholder="6-digit pincode"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newPincodeInput.length === 6) {
                    e.preventDefault();
                    if (!serviceablePincodes.some((p) => p.pincode === newPincodeInput)) {
                      setServiceablePincodes([...serviceablePincodes, { pincode: newPincodeInput, deliveryTime: newDeliveryTimeInput || '1h' }]);
                      setNewPincodeInput('');
                    }
                  }
                }}
              />
              <input
                type="text"
                value={newDeliveryTimeInput}
                onChange={(e) => setNewDeliveryTimeInput(e.target.value)}
                className={styles.deliveryTimeInput}
                placeholder="e.g. 1h, 2h, 15m"
                title="How much time for delivery"
              />
              <button
                type="button"
                onClick={() => {
                  if (newPincodeInput.length === 6 && !serviceablePincodes.some((p) => p.pincode === newPincodeInput)) {
                    setServiceablePincodes([...serviceablePincodes, { pincode: newPincodeInput, deliveryTime: newDeliveryTimeInput || '1h' }]);
                    setNewPincodeInput('');
                  }
                }}
                disabled={newPincodeInput.length !== 6 || serviceablePincodes.some((p) => p.pincode === newPincodeInput)}
                className={styles.addPincodeButton}
              >
                Add
              </button>
            </div>
            
            <div className={styles.helpText}>
              Add pincodes and delivery time (e.g. 1h, 2h, 15m, 30min). If no pincodes are added, delivery will be available for all pincodes.
            </div>
          </div>
        ) : (
          <div className={styles.formGroup}>
            <label className={styles.label}>
              Content {contentType === 'contact' ? '(Optional)' : '*'}
            </label>
            {contentType === 'contact' ? (
              <textarea
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                rows={4}
                className={styles.textarea}
                placeholder="Additional contact information..."
              />
            ) : (
              <RichTextEditor
                value={contentText}
                onChange={setContentText}
                placeholder="Enter content here..."
              />
            )}
          </div>
        )}

        <div className={styles.formActions}>
          <button
            type="submit"
            disabled={saving}
            className={styles.saveButton}
          >
            {saving ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <LoadingSpinner size="small" />
                Saving...
              </span>
            ) : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={handleToggleStatus}
            className={isActive ? styles.deactivateButton : styles.activateButton}
          >
            {isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className={styles.cancelButton}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
