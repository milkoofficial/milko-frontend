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
  help_support: 'Help support number',
  app_download: 'Download our App',
  homepage_products: 'Homepage Products Rows',
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
  const [deliveryTimeSlots, setDeliveryTimeSlots] = useState<Array<{ label: string; value: string; end?: string }>>([
    { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
    { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
  ]);
  const [newSlotValue, setNewSlotValue] = useState('06:00');
  const [newSlotEnd, setNewSlotEnd] = useState('09:00');

  const formatTime12h = (hhmm: string): string => {
    const [hRaw, mRaw] = String(hhmm || '').split(':');
    const h = Number(hRaw);
    const m = Number(mRaw);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
  };

  const buildRangeLabel = (start: string, end: string): string =>
    `${formatTime12h(start)} - ${formatTime12h(end)}`;

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
        if (Array.isArray(meta.deliveryTimeSlots) && meta.deliveryTimeSlots.length > 0) {
          const parsedSlots = meta.deliveryTimeSlots
            .map((slot: any) => ({
              label: (slot?.label || '').toString().trim(),
              value: (slot?.value || '').toString().trim(),
              end: (slot?.end || '').toString().trim(),
            }))
            .filter((slot: { label: string; value: string }) => slot.label && slot.value);
          setDeliveryTimeSlots(
            parsedSlots.length > 0
              ? parsedSlots
              : [
                  { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
                  { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
                ]
          );
        } else {
          setDeliveryTimeSlots([
            { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
            { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
          ]);
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch content:', error);
      // If this content type doesn't exist yet, allow creating it from the UI
      if (contentType === 'pincodes') {
        setError('');
        setContent(null);
        setTitle('Pincode Settings');
        setContentText('Delivery pincode settings');
        setMetadata({
          serviceablePincodes: [],
          deliveryTimeSlots: [
            { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
            { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
          ],
        });
        setServiceablePincodes([] as Array<{ pincode: string; deliveryTime: string }>);
        setDeliveryTimeSlots([
          { label: '06:00 AM - 09:00 AM', value: '06:00', end: '09:00' },
          { label: '05:00 PM - 08:00 PM', value: '17:00', end: '20:00' },
        ]);
        setIsActive(true);
      } else if (contentType === 'help_support') {
        setError('');
        setContent(null);
        setTitle('Help support number');
        setContentText('Support contact for Need help button.');
        setMetadata({ helpSupportNumber: '' });
        setIsActive(true);
      } else if (contentType === 'app_download') {
        setError('');
        setContent(null);
        setTitle('Download our App');
        setContentText('Mobile app store link for Account page.');
        setMetadata({ downloadAppUrl: '' });
        setIsActive(true);
      } else if (contentType === 'homepage_products') {
        setError('');
        setContent(null);
        setTitle('Homepage Products Rows');
        setContentText('Homepage products section settings.');
        setMetadata({ rows: 1 });
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
        const validSlots = deliveryTimeSlots
          .map((slot) => ({
            value: (slot.value || '').toString().trim(),
            end: (slot.end || '').toString().trim(),
            label: buildRangeLabel((slot.value || '').toString().trim(), (slot.end || '').toString().trim()),
          }))
          .filter((slot) => slot.label && slot.value && slot.end);

        if (validSlots.length === 0) {
          setError('Please keep at least one delivery time slot.');
          return;
        }

        finalMetadata = { serviceablePincodes: withTime, deliveryTimeSlots: validSlots };
      }

      // Handle help_support (Need help button: WhatsApp number or custom link)
      if (contentType === 'help_support') {
        finalMetadata = { helpSupportNumber: (metadata.helpSupportNumber || '').toString().trim() };
      }

      // Handle app_download (Account page store / custom URL)
      if (contentType === 'app_download') {
        const raw = (metadata.downloadAppUrl || '').toString().trim();
        let downloadAppUrl = '';
        if (raw) {
          const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
          try {
            const u = new URL(withScheme);
            if (u.protocol !== 'http:' && u.protocol !== 'https:') {
              setError('Please enter a valid URL (http or https).');
              setSaving(false);
              return;
            }
            downloadAppUrl = u.toString();
          } catch {
            setError('Please enter a valid URL.');
            setSaving(false);
            return;
          }
        }
        finalMetadata = { downloadAppUrl };
      }

      // Handle homepage_products
      if (contentType === 'homepage_products') {
        const raw = Number(metadata.rows);
        const rows = Number.isFinite(raw) ? Math.max(1, Math.min(10, Math.floor(raw))) : 1;
        finalMetadata = { rows };
      }

      await adminContentApi.update(contentType, {
        title:
          contentType === 'pincodes'
            ? 'Pincode Settings'
            : contentType === 'help_support'
              ? 'Help support number'
              : contentType === 'app_download'
                ? 'Download our App'
                : title,
        content:
          contentType === 'pincodes'
            ? 'Delivery pincode settings'
            : contentType === 'help_support'
              ? 'Support contact for Need help button.'
              : contentType === 'app_download'
                ? 'Mobile app store link for Account page.'
                : contentText,
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
        {contentType !== 'pincodes' && contentType !== 'help_support' && contentType !== 'app_download' && (
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

        {contentType === 'help_support' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Number or link *</label>
            <input
              type="text"
              value={metadata.helpSupportNumber || ''}
              onChange={(e) => setMetadata({ ...metadata, helpSupportNumber: e.target.value })}
              className={styles.input}
              placeholder="e.g. 919876543210 or https://wa.me/919876543210 or https://t.me/username"
            />
            <div className={styles.helpText} style={{ marginTop: '0.5rem' }}>
              Phone with country code (e.g. 919876543210) for WhatsApp, or a full URL (e.g. https://t.me/username) for Telegram or custom app.
            </div>
          </div>
        )}

        {contentType === 'app_download' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>App / store URL</label>
            <input
              type="text"
              value={metadata.downloadAppUrl || ''}
              onChange={(e) => setMetadata({ ...metadata, downloadAppUrl: e.target.value })}
              className={styles.input}
              placeholder="https://play.google.com/store/apps/details?id=..."
            />
            <div className={styles.helpText} style={{ marginTop: '0.5rem' }}>
              Shown on the mobile Account page &quot;Download our App&quot; row. Leave empty to use{' '}
              <code style={{ fontSize: '0.9em' }}>NEXT_PUBLIC_PLAY_STORE_URL</code> or the default Play Store link.
            </div>
          </div>
        )}

        {contentType === 'homepage_products' && (
          <div className={styles.formGroup}>
            <label className={styles.label}>Homepage rows (Our Products)</label>
            <input
              type="number"
              min={1}
              max={10}
              step={1}
              value={metadata.rows ?? 1}
              onChange={(e) => setMetadata({ ...metadata, rows: e.target.value === '' ? 1 : Number(e.target.value) })}
              className={styles.input}
            />
            <div className={styles.helpText}>
              Sets how many rows are shown on the homepage product grid. The shop/products page will still show all products.
            </div>
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

            <div className={styles.deliverySlotsBlock}>
              <label className={styles.label}>Subscription delivery slots</label>
              <div className={styles.helpText}>
                These slots appear in the customer subscription page delivery-time dropdown as ranges.
              </div>

              {deliveryTimeSlots.length > 0 && (
                <div className={styles.deliverySlotList}>
                  {deliveryTimeSlots.map((slot, index) => (
                    <div key={`${slot.value}-${index}`} className={styles.deliverySlotItem}>
                      <input
                        type="time"
                        value={slot.value}
                        onChange={(e) => {
                          const next = [...deliveryTimeSlots];
                          next[index] = { ...next[index], value: e.target.value };
                          setDeliveryTimeSlots(next);
                        }}
                        className={styles.deliveryTimeInput}
                      />
                      <input
                        type="time"
                        value={slot.end || ''}
                        onChange={(e) => {
                          const next = [...deliveryTimeSlots];
                          next[index] = { ...next[index], end: e.target.value };
                          setDeliveryTimeSlots(next);
                        }}
                        className={styles.deliveryTimeInput}
                      />
                      <input
                        type="text"
                        value={buildRangeLabel(slot.value, slot.end || slot.value)}
                        readOnly
                        className={styles.input}
                        placeholder="Range"
                      />
                      <button
                        type="button"
                        onClick={() => setDeliveryTimeSlots(deliveryTimeSlots.filter((_, i) => i !== index))}
                        className={styles.removePincodeButton}
                        aria-label={`Remove slot ${slot.label || slot.value}`}
                      >
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className={styles.addPincodeRow}>
                <input
                  type="time"
                  value={newSlotValue}
                  onChange={(e) => setNewSlotValue(e.target.value)}
                  className={styles.deliveryTimeInput}
                />
                <input
                  type="time"
                  value={newSlotEnd}
                  onChange={(e) => setNewSlotEnd(e.target.value)}
                  className={styles.deliveryTimeInput}
                />
                <input
                  type="text"
                  value={buildRangeLabel(newSlotValue, newSlotEnd)}
                  readOnly
                  className={styles.input}
                  placeholder="Range"
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = newSlotValue.trim();
                    const end = newSlotEnd.trim();
                    if (!value || !end) return;
                    if (deliveryTimeSlots.some((s) => s.value === value && (s.end || '') === end)) return;
                    setDeliveryTimeSlots([
                      ...deliveryTimeSlots,
                      { label: buildRangeLabel(value, end), value, end },
                    ]);
                  }}
                  disabled={!newSlotValue.trim() || !newSlotEnd.trim()}
                  className={styles.addPincodeButton}
                >
                  Add slot
                </button>
              </div>
            </div>
          </div>
        ) : contentType === 'help_support' || contentType === 'app_download' ? null : (
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
