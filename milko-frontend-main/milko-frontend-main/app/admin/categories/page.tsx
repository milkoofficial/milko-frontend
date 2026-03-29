'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllCategories, createCategory, updateCategory, deleteCategory, Category } from '@/lib/api/categories';
import { useToast } from '@/contexts/ToastContext';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';

/**
 * Admin Categories Management Page
 * Create, edit, and delete product categories
 */
export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'nameAsc' | 'nameDesc' | 'createdDesc'>('nameAsc');
  const { showToast } = useToast();

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      showToast(error instanceof Error ? error.message : 'Failed to fetch categories', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let result = [...categories];

    // Search filter
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      result = result.filter(
        (cat) =>
          cat.name.toLowerCase().includes(q) ||
          (cat.description || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sort === 'nameAsc') return a.name.localeCompare(b.name);
      if (sort === 'nameDesc') return b.name.localeCompare(a.name);
      // createdDesc
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return result;
  }, [categories, query, sort]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    try {
      setSubmitting(true);
      
      if (editingCategory) {
        await updateCategory(editingCategory.id, formData);
        showToast('Category updated successfully', 'success');
      } else {
        await createCategory(formData);
        showToast('Category created successfully', 'success');
      }
      
      await fetchCategories();
      handleCancel();
    } catch (error) {
      console.error('Failed to save category:', error);
      showToast(error instanceof Error ? error.message : 'Failed to save category', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Products using this category will have their category unassigned.')) {
      return;
    }

    try {
      await deleteCategory(id);
      showToast('Category deleted successfully', 'success');
      await fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
      showToast(error instanceof Error ? error.message : 'Failed to delete category', 'error');
    }
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setFormData({
      name: '',
      description: '',
    });
  };

  // Custom Select Component
  function CustomSelect<T extends string>({
    value,
    onChange,
    options,
  }: {
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string }[];
  }) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement | null>(null);

    const selected = options.find((o) => o.value === value) || options[0];

    useEffect(() => {
      const onDocClick = (e: MouseEvent) => {
        if (ref.current && !ref.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      document.addEventListener('mousedown', onDocClick);
      return () => document.removeEventListener('mousedown', onDocClick);
    }, []);

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

        {open && (
          <div className={styles.dropdown} role="listbox" aria-label="Select option">
            {options.map((opt) => {
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
                  {isActive ? <span style={{ fontWeight: 700, color: '#004e85', fontSize: '.85rem', background: '#cfe4ff', borderRadius: '5px', padding: '3px 6px' }}>Selected</span> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

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
      <div className={styles.headerRow}>
        <div>
          <h1 className={adminStyles.adminPageTitle}>Product Categories</h1>
          <p className={styles.subtitle}>Organize products into categories for better management</p>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => setIsFormOpen(true)} 
            className={adminStyles.adminButton}
          >
            Add Category
          </button>
        )}
      </div>

      {/* Form Panel */}
      {isFormOpen && (
        <div className={styles.formPanel}>
          <div className={styles.formHeader}>
            <h2 className={styles.formTitle}>
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </h2>
            <button 
              onClick={handleCancel} 
              className={styles.backLink}
            >
              ← Back
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.label}>
                Category Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={styles.input}
                placeholder="e.g., Dairy Products, Fresh Milk, etc."
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={styles.textarea}
                placeholder="Optional description for this category"
                rows={3}
              />
            </div>

            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.saveButton}
                disabled={submitting}
              >
                {submitting ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className={styles.cancelButton}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toolbar */}
      {!isFormOpen && (
        <div className={styles.toolbar}>
          <div className={styles.searchWrap}>
            <svg className={styles.searchIcon} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16ZM18 18l-4.35-4.35" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories..."
              className={styles.searchInput}
            />
          </div>

          <CustomSelect<'nameAsc' | 'nameDesc' | 'createdDesc'>
            value={sort}
            onChange={setSort}
            options={[
              { value: 'nameAsc', label: 'Name (A-Z)' },
              { value: 'nameDesc', label: 'Name (Z-A)' },
              { value: 'createdDesc', label: 'Newest First' },
            ]}
          />
        </div>
      )}

      {/* Categories Table */}
      {!isFormOpen && (
        <div className={styles.panel}>
          {filtered.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No categories found</p>
              {query && <p className={styles.emptyStateSubtext}>Try adjusting your search</p>}
            </div>
          ) : (
            <div className={styles.table}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <div className={styles.categoryName}>{category.name}</div>
                      </td>
                      <td>
                        <div className={styles.categoryDescription}>
                          {category.description || <span className={styles.noDescription}>No description</span>}
                        </div>
                      </td>
                      <td>
                        <div className={styles.dateCell}>
                          {new Date(category.createdAt || '').toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      </td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            onClick={() => handleEdit(category)}
                            className={styles.linkButton}
                            title="Edit Category"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
                            className={`${styles.linkButton} ${styles.deleteButton}`}
                            title="Delete Category"
                          >
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18">
                              <path d="M10 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M14 11V17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M4 7H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M6 7H18V18C18 19.6569 16.6569 21 15 21H9C7.34315 21 6 19.6569 6 18V7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              <path d="M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7H9V5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
