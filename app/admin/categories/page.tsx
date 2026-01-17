'use client';

import { useEffect, useState } from 'react';
import { getAllCategories, createCategory, updateCategory, deleteCategory, Category } from '@/lib/api/categories';
import { useToast } from '@/contexts/ToastContext';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
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

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading categories..." />
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div className={adminStyles.adminPageHeader}>
        <h1 className={adminStyles.adminPageTitle}>Product Categories</h1>
        {!isFormOpen && (
          <button 
            onClick={() => setIsFormOpen(true)} 
            className={adminStyles.adminButton}
          >
            Add Category
          </button>
        )}
      </div>

      {/* Form */}
      {isFormOpen && (
        <div className={styles.productForm}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: '600' }}>
              {editingCategory ? 'Edit Category' : 'Create New Category'}
            </h2>
            <button 
              onClick={handleCancel} 
              className={adminStyles.adminButton}
              style={{ background: '#6c757d' }}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>
                Category Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={styles.formInput}
                placeholder="e.g., Dairy Products, Fresh Milk, etc."
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={styles.formTextarea}
                placeholder="Optional description for this category"
                rows={3}
              />
            </div>

            <button
              type="submit"
              className={adminStyles.adminButton}
              disabled={submitting}
            >
              {submitting ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
            </button>
          </form>
        </div>
      )}

      {/* Categories List */}
      {categories.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          color: '#6b7280',
          background: 'white',
          borderRadius: '8px',
          marginTop: '2rem'
        }}>
          <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No categories found</p>
          <p style={{ fontSize: '0.875rem' }}>Create your first category to organize products</p>
        </div>
      ) : (
        <div className={styles.productsTable}>
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
              {categories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <strong>{category.name}</strong>
                  </td>
                  <td>
                    {category.description || <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No description</span>}
                  </td>
                  <td>
                    {new Date(category.createdAt || '').toLocaleDateString()}
                  </td>
                  <td>
                    <div className={styles.actionButtons}>
                      <button
                        onClick={() => handleEdit(category)}
                        className={styles.editButton}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className={styles.deleteButton}
                      >
                        Delete
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
  );
}
