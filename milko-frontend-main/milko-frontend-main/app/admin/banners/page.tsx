'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { adminBannersApi, Banner } from '@/lib/api';
import LoadingSpinner, { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { useToast } from '@/contexts/ToastContext';

/**
 * Admin Banners Page
 * Manage homepage banners
 */
export default function AdminBannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    link: '',
    orderIndex: '0',
    isActive: true,
    adaptToFirstImage: false,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [mobileImageFile, setMobileImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [mobileImagePreview, setMobileImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'orderAsc' | 'orderDesc' | 'titleAsc' | 'updatedDesc'>('orderAsc');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchExpandRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchBanners();
  }, []);

  useEffect(() => {
    if (!searchExpanded) return;
    const onDown = (e: MouseEvent) => {
      const el = searchExpandRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      setSearchExpanded(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchExpanded]);

  const fetchBanners = async () => {
    try {
      const data = await adminBannersApi.getAll();
      setBanners(data);
    } catch (error) {
      console.error('Failed to fetch banners:', error);
      showToast('Failed to load banners', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMobileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMobileImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setMobileImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append(
        'description',
        editingBanner ? (editingBanner.description || '') : ''
      );
      formDataToSend.append('link', formData.link || '');
      formDataToSend.append('orderIndex', formData.orderIndex);
      formDataToSend.append('isActive', formData.isActive.toString());
      formDataToSend.append('adaptToFirstImage', formData.adaptToFirstImage.toString());

      if (imageFile) {
        formDataToSend.append('image', imageFile);
      }

      if (mobileImageFile) {
        formDataToSend.append('mobileImage', mobileImageFile);
      }

      if (editingBanner) {
        await adminBannersApi.update(editingBanner.id, formDataToSend);
        showToast('Banner updated successfully', 'success');
      } else {
        if (!imageFile) {
          showToast('Desktop image is required', 'error');
          setSubmitting(false);
          return;
        }
        await adminBannersApi.create(formDataToSend);
        showToast('Banner created successfully', 'success');
      }

      // Reset form
      setFormData({ title: '', link: '', orderIndex: '0', isActive: true, adaptToFirstImage: false });
      setImageFile(null);
      setMobileImageFile(null);
      setImagePreview(null);
      setMobileImagePreview(null);
      setShowForm(false);
      setEditingBanner(null);
      fetchBanners();
    } catch (error: any) {
      console.error('Failed to save banner:', error);
      showToast(error.message || 'Failed to save banner', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title || '',
      link: banner.link || '',
      orderIndex: banner.orderIndex.toString(),
      isActive: banner.isActive,
      adaptToFirstImage: banner.adaptToFirstImage || false,
    });
    setImagePreview(banner.imageUrl);
    setMobileImagePreview(banner.mobileImageUrl || null);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this banner?')) {
      return;
    }

    try {
      await adminBannersApi.delete(id);
      showToast('Banner deleted successfully', 'success');
      fetchBanners();
    } catch (error) {
      console.error('Failed to delete banner:', error);
      showToast('Failed to delete banner', 'error');
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingBanner(null);
    setFormData({ title: '', link: '', orderIndex: '0', isActive: true, adaptToFirstImage: false });
    setImageFile(null);
    setMobileImageFile(null);
    setImagePreview(null);
    setMobileImagePreview(null);
  };

  const filtered = useMemo(() => {
    return banners
      .filter((b) => {
        const q = query.trim().toLowerCase();
        if (!q) return true;
        return (
          (b.title || '').toLowerCase().includes(q) ||
          (b.description || '').toLowerCase().includes(q) ||
          (b.link || '').toLowerCase().includes(q)
        );
      })
      .filter((b) => {
        if (statusFilter === 'all') return true;
        return statusFilter === 'active' ? b.isActive : !b.isActive;
      })
      .sort((a, b) => {
        if (sort === 'orderAsc') return a.orderIndex - b.orderIndex;
        if (sort === 'orderDesc') return b.orderIndex - a.orderIndex;
        if (sort === 'titleAsc') return (a.title || '').localeCompare(b.title || '');
        // updatedDesc default
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [banners, query, statusFilter, sort]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading banners..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {!showForm && (
        <>
          <div className={styles.headerRow}>
            <div>
              <h1 className={adminStyles.adminPageTitle}>Banners</h1>
              <div className={styles.subtitle}>
                {filtered.length} banner{filtered.length !== 1 ? 's' : ''} shown
                {banners.length !== filtered.length ? ` (filtered from ${banners.length})` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={`${adminStyles.adminButton} ${styles.addBannerDesktop}`}
            >
              Add Banner
            </button>
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className={styles.addBannerIconLink}
              aria-label="Add new banner"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.25" aria-hidden="true">
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className={`${styles.toolbar} ${searchExpanded ? styles.toolbarSearchExpanded : ''}`}>
            <div className={styles.searchSlot} ref={searchExpandRef}>
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M20 20l-3.5-3.5" />
                  </svg>
                </span>
                <input
                  className={styles.searchInput}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  placeholder="Search by title, description, or link…"
                  aria-label="Search banners"
                />
              </div>
            </div>

            <div className={styles.filterSlot}>
              <CustomSelect<'all' | 'active' | 'inactive'>
                value={statusFilter}
                onChange={setStatusFilter}
                modalTitle="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
              />

              <CustomSelect<'orderAsc' | 'orderDesc' | 'titleAsc' | 'updatedDesc'>
                value={sort}
                onChange={setSort}
                modalTitle="Sort"
                options={[
                  { value: 'orderAsc', label: 'Sort: Order (low → high)' },
                  { value: 'orderDesc', label: 'Sort: Order (high → low)' },
                  { value: 'titleAsc', label: 'Sort: Title (A → Z)' },
                  { value: 'updatedDesc', label: 'Sort: Recently updated' },
                ]}
              />
            </div>
          </div>

          <div className={styles.panel}>
            {filtered.length === 0 ? (
              <div className={styles.emptyState}>
                No banners found. Try clearing filters or create a new banner.
              </div>
            ) : (
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr>
                    <th className={styles.th}>Banner</th>
                    <th className={styles.th}>Link</th>
                    <th className={styles.th}>Order</th>
                    <th className={styles.th}>Status</th>
                    <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((banner) => (
                    <tr key={banner.id} className={styles.row}>
                      <td className={styles.td}>
                        <div className={styles.bannerCell}>
                          <div className={styles.thumb}>
                            {banner.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={banner.imageUrl} alt={banner.title || 'Banner'} />
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No image</span>
                            )}
                          </div>
                          <div>
                            <div className={styles.bannerName}>{banner.title || '(No title)'}</div>
                            {banner.description && (
                              <div className={styles.bannerMeta}>{banner.description}</div>
                            )}
                            {banner.mobileImageUrl && (
                              <div className={styles.bannerMeta} style={{ marginTop: '0.25rem' }}>
                                📱 Has mobile image
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className={styles.td}>
                        {banner.link ? (
                          <a 
                            href={banner.link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className={styles.linkUrl}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {banner.link.length > 30 ? `${banner.link.substring(0, 30)}...` : banner.link}
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>
                      <td className={styles.td}>
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{banner.orderIndex}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={`${styles.badge} ${banner.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                          {banner.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className={styles.td}>
                        <div className={styles.actions}>
                          <button
                            onClick={() => handleEdit(banner)}
                            className={styles.linkButton}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(banner.id)}
                            className={`${styles.linkButton} ${styles.deleteButton}`}
                            aria-label="Delete banner"
                            title="Delete banner"
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className={styles.cards}>
            {filtered.length === 0 ? (
              <div className={styles.card}>
                <div className={styles.emptyState} style={{ padding: '1rem' }}>
                  No banners found.
                </div>
              </div>
            ) : (
              filtered.map((banner) => (
                <div className={styles.card} key={banner.id}>
                  <div className={styles.cardTop}>
                    <div className={styles.cardTitleRow}>
                      <div className={styles.thumb}>
                        {banner.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={banner.imageUrl} alt={banner.title || 'Banner'} />
                        ) : (
                          <span style={{ color: '#64748b', fontSize: '0.75rem' }}>No image</span>
                        )}
                      </div>
                      <div>
                        <div className={styles.bannerName}>{banner.title || '(No title)'}</div>
                        {banner.description ? (
                          <div className={styles.bannerMeta}>{banner.description}</div>
                        ) : null}
                        {banner.mobileImageUrl ? (
                          <div className={styles.bannerMeta} style={{ marginTop: '0.25rem' }}>
                            Has mobile image
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <span className={`${styles.badge} ${banner.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                      {banner.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.kv}>
                      <div className={styles.kvLabel}>LINK</div>
                      <div className={styles.kvValue}>
                        {banner.link ? (
                          <a
                            href={banner.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.cardLink}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {banner.link.length > 42 ? `${banner.link.substring(0, 42)}…` : banner.link}
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8', fontWeight: 600 }}>—</span>
                        )}
                      </div>
                    </div>
                    <div className={styles.kv}>
                      <div className={styles.kvLabel}>ORDER</div>
                      <div className={styles.kvValue}>{banner.orderIndex}</div>
                    </div>
                  </div>

                  <div className={styles.cardActions}>
                    <button type="button" onClick={() => handleEdit(banner)} className={styles.linkButton}>
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(banner.id)}
                      className={`${styles.linkButton} ${styles.deleteButton}`}
                      aria-label="Delete banner"
                      title="Delete banner"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {showForm && (
        <div className={styles.formPanel}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {editingBanner ? 'Edit Banner' : 'Add New Banner'}
            </h2>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleCancel();
              }}
              className={styles.backLink}
            >
              ← Back to Banners
            </a>
          </div>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Title (optional)</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className={styles.input}
                placeholder="Banner title"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Link URL (optional)</label>
              <input
                type="url"
                value={formData.link}
                onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                placeholder="https://example.com or /products"
                className={styles.input}
              />
              <div className={styles.helpText}>
                If provided, the banner will be clickable and redirect to this URL
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Desktop Image {!editingBanner && '*'}</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                required={!editingBanner}
                className={styles.input}
                style={{ padding: '0.5rem' }}
              />
              {imagePreview && (
                <div className={styles.imagePreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Desktop Preview" />
                </div>
              )}
              <div className={styles.helpText}>
                Shown on desktop devices (screens wider than 768px)
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Mobile Image (optional)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleMobileImageChange}
                className={styles.input}
                style={{ padding: '0.5rem' }}
              />
              {mobileImagePreview && (
                <div className={styles.imagePreview}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={mobileImagePreview} alt="Mobile Preview" />
                </div>
              )}
              <div className={styles.helpText}>
                Shown on mobile devices (screens 768px and below). If not provided, desktop image will be used.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Order Index (lower numbers appear first)</label>
              <input
                type="number"
                value={formData.orderIndex}
                onChange={(e) => setFormData({ ...formData, orderIndex: e.target.value })}
                className={styles.input}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className={styles.checkbox}
                />
                Active
              </label>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={formData.adaptToFirstImage}
                  onChange={(e) => setFormData({ ...formData, adaptToFirstImage: e.target.checked })}
                  className={styles.checkbox}
                />
                Adapt to first image
              </label>
              <div className={styles.helpText} style={{ marginLeft: '1.5rem' }}>
                If enabled, the banner container will adapt its height to match the first image&apos;s aspect ratio
              </div>
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                disabled={submitting}
                className={styles.saveButton}
              >
                {submitting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <LoadingSpinner size="small" />
                    Saving...
                  </span>
                ) : editingBanner ? 'Update Banner' : 'Create Banner'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function CustomSelect<T extends string>({
  value,
  onChange,
  options,
  modalTitle,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
  modalTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const modalTitleId = useId();

  const selected = options.find((o) => o.value === value) || options[0];
  const useModal = isNarrow;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const apply = () => setIsNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open || useModal) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, useModal]);

  useEffect(() => {
    if (open && useModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open, useModal]);

  const optionList = options.map((opt) => {
    const isActive = opt.value === value;
    return (
      <button
        key={opt.value}
        type="button"
        role="option"
        aria-selected={isActive}
        className={`${styles.dropdownItem} ${isActive ? styles.dropdownItemActive : ''}`}
        onClick={() => {
          onChange(opt.value);
          setOpen(false);
        }}
      >
        <span>{opt.label}</span>
        {isActive ? <span className={styles.dropdownHint}>Selected</span> : null}
      </button>
    );
  });

  return (
    <div className={styles.selectWrap} ref={ref}>
      <button
        type="button"
        className={styles.selectButton}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.selectValue}>{selected?.label}</span>
        <span className={styles.selectChevron} aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5.5 7.5L10 12l4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && !useModal && (
        <div className={styles.dropdown} role="listbox" aria-label={modalTitle}>
          {optionList}
        </div>
      )}

      {mounted && open && useModal
        ? createPortal(
            <div
              className={styles.selectModalBackdrop}
              role="presentation"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                className={styles.selectModalPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={modalTitleId}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className={styles.selectModalHeader}>
                  <h2 id={modalTitleId} className={styles.selectModalTitle}>
                    {modalTitle}
                  </h2>
                  <button type="button" className={styles.selectModalClose} aria-label="Close" onClick={() => setOpen(false)}>
                    ×
                  </button>
                </div>
                <div className={styles.selectModalBody} role="listbox" aria-label={modalTitle}>
                  {optionList}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
