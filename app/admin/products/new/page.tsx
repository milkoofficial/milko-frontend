'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { adminProductsApi } from '@/lib/api';
import { getAllCategories, Category } from '@/lib/api/categories';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import adminStyles from '../../admin-styles.module.css';
import styles from './page.module.css';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';

interface ProductVariation {
  size: string;
  price: string;
}

/**
 * Admin Create New Product Page
 * Create a new product
 */
export default function AdminCreateProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Array<{ file: File; preview: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [categoryId, setCategoryId] = useState('');
  const [suffixAfterPrice, setSuffixAfterPrice] = useState('Litres');
  const [isActive, setIsActive] = useState(true);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [newVariation, setNewVariation] = useState<ProductVariation>({ size: '', price: '' });

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const data = await getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleAddVariation = () => {
    if (!newVariation.size || !newVariation.price) {
      setError('Variation size and price are required');
      return;
    }
    setVariations([...variations, newVariation]);
    setNewVariation({ size: '', price: '' });
    setError('');
  };

  const handleRemoveVariation = (index: number) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const handleImageChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: Array<{ file: File; preview: string }> = [];
    
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          newImages.push({
            file,
            preview: reader.result as string,
          });
          
          // Update state when all files are read
          if (newImages.length === Array.from(files).length) {
            setImagePreviews((prev) => [...prev, ...newImages]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleImageChange(e.target.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleImageChange(e.dataTransfer.files);
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAllImages = () => {
    setImagePreviews([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validate
    if (!name) {
      setError('Product name is required');
      setLoading(false);
      return;
    }

    // If no variations, selling price is required
    if (variations.length === 0 && !sellingPrice) {
      setError('Selling Price is required when no variations are added');
      setLoading(false);
      return;
    }

    // Validate discount pricing
    if (sellingPrice && compareAtPrice) {
      const selling = parseFloat(sellingPrice);
      const compare = parseFloat(compareAtPrice);
      if (Number.isFinite(selling) && Number.isFinite(compare) && selling > compare) {
        setError('Selling Price cannot be greater than Compare At Price');
        setLoading(false);
        return;
      }
    }

    // If variations exist, at least one variation is required
    if (variations.length > 0 && variations.some(v => !v.size || !v.price)) {
      setError('All variations must have both size and price');
      setLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('description', sanitizeHtml(description));
      // Use selling price as the main price field
      if (variations.length === 0) {
        // When no variations, use selling price for both pricePerLitre (backend requirement) and sellingPrice
        const mainPrice = sellingPrice || '0';
        formData.append('pricePerLitre', mainPrice);
        formData.append('sellingPrice', mainPrice);
      } else {
        // Use first variation price as base price (required by backend)
        formData.append('pricePerLitre', variations[0].price);
        // Still allow selling price to be set separately if provided
        if (sellingPrice) {
          formData.append('sellingPrice', sellingPrice);
        }
      }
      if (compareAtPrice) {
        formData.append('compareAtPrice', compareAtPrice);
      }
      formData.append('quantity', quantity);
      formData.append('lowStockThreshold', lowStockThreshold);
      if (categoryId) {
        formData.append('categoryId', categoryId);
      }
      formData.append('suffixAfterPrice', suffixAfterPrice);
      formData.append('isActive', isActive.toString());
      
      // Use first image as main product image
      if (imagePreviews.length > 0) {
        formData.append('image', imagePreviews[0].file);
      }

      const product = await adminProductsApi.create(formData);
      
      // Upload additional images (skip first one as it's already uploaded as main image)
      if (imagePreviews.length > 1) {
        for (let i = 1; i < imagePreviews.length; i++) {
          try {
            await adminProductsApi.addImage(product.id, imagePreviews[i].file, i);
          } catch (err) {
            console.error('Failed to add image:', err);
          }
        }
      }
      
      // Create variations if any
      if (variations.length > 0) {
        for (const variation of variations) {
          try {
            await adminProductsApi.addVariation(product.id, {
              size: variation.size,
              price: parseFloat(variation.price),
              isAvailable: true,
              displayOrder: variations.indexOf(variation),
            });
          } catch (err) {
            console.error('Failed to create variation:', err);
          }
        }
      }
      
      alert('Product created successfully!');
      router.push(`/admin/products/${product.id}`);
    } catch (err: any) {
      console.error('Failed to create product:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button 
          onClick={() => router.back()} 
          className={styles.backButton}
        >
          ← Back to Products
        </button>
        <h1 className={adminStyles.adminPageTitle}>Create New Product</h1>
      </div>

      {error && (
        <div className={styles.errorMessage}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.formContainer}>
        {/* Basic Information Section */}
        <div className={styles.formSection}>
          <h2 className={styles.formSectionTitle}>Basic Information</h2>
          
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>
              Product Name<span className={styles.formLabelRequired}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className={styles.formInput}
              placeholder="e.g., Fresh Cow Milk"
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Description</label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe your product..."
            />
          </div>

          {variations.length === 0 && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Selling Price (₹)<span className={styles.formLabelRequired}>*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  required={variations.length === 0}
                  min="0"
                  className={styles.formInput}
                  placeholder="0.00"
                />
                <p className={styles.formHelpText}>
                  The current selling price of the product. This field is only shown when no variations are added.
                </p>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  Compare At Price (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={compareAtPrice}
                  onChange={(e) => setCompareAtPrice(e.target.value)}
                  min="0"
                  className={styles.formInput}
                  placeholder="0.00"
                />
                <p className={styles.formHelpText}>
                  Original price (shown with strikethrough for discounts)
                </p>
              </div>
            </div>
          )}
          
          {variations.length > 0 && (
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <div style={{ 
                  padding: '0.75rem 1rem', 
                  background: '#eff6ff', 
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe',
                  color: '#1e40af',
                  fontSize: '0.9rem',
                  lineHeight: '1.5'
                }}>
                  <strong>Note:</strong> Since you have added variations with individual prices, the base price fields are hidden. Each variation will use its own price.
                </div>
              </div>
            </div>
          )}
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Suffix After Price</label>
              <input
                type="text"
                value={suffixAfterPrice}
                onChange={(e) => setSuffixAfterPrice(e.target.value)}
                className={styles.formInput}
                placeholder="e.g., Litres, /kg, /litre"
              />
              <p className={styles.formHelpText}>
                Displayed as: ₹{sellingPrice || '0'}/{suffixAfterPrice}
              </p>
            </div>
          </div>
        </div>

        {/* Inventory & Category Section */}
        <div className={styles.formSection}>
          <h2 className={styles.formSectionTitle}>Inventory & Category</h2>
          
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Quantity in Stock</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min="0"
                className={styles.formInput}
                placeholder="0"
              />
              <p className={styles.formHelpText}>
                Note: Quantity will not be displayed to customers
              </p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Low Stock Threshold</label>
              <input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                min="0"
                className={styles.formInput}
                placeholder="10"
              />
              <p className={styles.formHelpText}>
                Show &quot;Low in stock&quot; when quantity falls below this number
              </p>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={styles.formSelect}
            >
              <option value="">No Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className={`${styles.formHelpText} ${styles.formHelpTextError}`}>
                No categories found. Create categories in Admin &gt; More &gt; Categories
              </p>
            )}
          </div>
        </div>

        {/* Product Images Section */}
        <div className={styles.formSection}>
          <h2 className={styles.formSectionTitle}>Product Images</h2>
          
          <div className={styles.imageUploadSection}>
            <div
              className={`${styles.imageUploadArea} ${isDragging ? styles.dragover : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ margin: '0 auto 1rem', color: '#9ca3af' }}
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <p style={{ color: '#6b7280', marginBottom: '0.5rem', fontSize: '1rem' }}>
                Click to upload or drag and drop
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                PNG, JPG, GIF up to 5MB each (Multiple images supported)
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInputChange}
              className={styles.fileInput}
            />
            
            {imagePreviews.length > 0 && (
              <>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginTop: '1.5rem',
                  marginBottom: '1rem'
                }}>
                  <p className={styles.formHelpText} style={{ margin: 0 }}>
                    {imagePreviews.length} image{imagePreviews.length !== 1 ? 's' : ''} selected
                    {imagePreviews.length > 0 && (
                      <span style={{ marginLeft: '0.5rem', color: '#059669' }}>
                        (First image will be the main product image)
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={clearAllImages}
                    style={{
                      padding: '0.5rem 1rem',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    Clear All
                  </button>
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                  gap: '1rem',
                  marginTop: '1rem'
                }}>
                  {imagePreviews.map((imageData, index) => (
                    <div key={index} style={{ position: 'relative' }}>
                      <div style={{
                        position: 'relative',
                        paddingBottom: '100%',
                        background: '#f3f4f6',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: index === 0 ? '3px solid #10b981' : '2px solid #e5e7eb'
                      }}>
                        <img
                          src={imageData.preview}
                          alt={`Preview ${index + 1}`}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                        {index === 0 && (
                          <div style={{
                            position: 'absolute',
                            top: '0.5rem',
                            left: '0.5rem',
                            background: '#10b981',
                            color: 'white',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            Main
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className={styles.removeImageButton}
                          style={{
                            top: '0.5rem',
                            right: '0.5rem',
                            width: '28px',
                            height: '28px',
                            fontSize: '1rem'
                          }}
                          aria-label="Remove image"
                        >
                          ×
                        </button>
                      </div>
                      <p style={{
                        marginTop: '0.5rem',
                        fontSize: '0.75rem',
                        color: '#6b7280',
                        textAlign: 'center',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {imageData.file.name}
                      </p>
                      <p style={{
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                        textAlign: 'center'
                      }}>
                        {(imageData.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Product Variations Section */}
        <div className={styles.formSection}>
          <h2 className={styles.formSectionTitle}>Product Variations</h2>
          
          <div className={styles.variationsSection}>
            <p className={styles.formHelpText} style={{ marginBottom: '1.5rem' }}>
              Add different sizes/variations with their own prices (e.g., 1L for ₹50, 2L for ₹95)
            </p>
            
            {variations.length > 0 && (
              <div className={styles.variationsList}>
                {variations.map((variation, index) => (
                  <div key={index} className={styles.variationItem}>
                    <div className={styles.variationInfo}>
                      <span className={styles.variationSize}>{variation.size}</span>
                      <span className={styles.variationPrice}>₹{variation.price}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveVariation(index)}
                      className={styles.removeVariationButton}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <div className={styles.variationInputs}>
              <div className={styles.variationInputGroup}>
                <label className={styles.variationInputLabel}>Size</label>
                <input
                  type="text"
                  value={newVariation.size}
                  onChange={(e) => setNewVariation({ ...newVariation, size: e.target.value })}
                  placeholder="e.g., 1L, 2L, 500ml"
                  className={styles.variationInput}
                />
              </div>
              <div className={styles.variationInputGroup}>
                <label className={styles.variationInputLabel}>Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={newVariation.price}
                  onChange={(e) => setNewVariation({ ...newVariation, price: e.target.value })}
                  placeholder="e.g., 50, 95"
                  min="0"
                  className={styles.variationInput}
                />
              </div>
              <button
                type="button"
                onClick={handleAddVariation}
                className={styles.addVariationButton}
              >
                + Add
              </button>
            </div>
          </div>
        </div>

        {/* Status Section */}
        <div className={styles.formSection}>
          <div className={styles.checkboxGroup}>
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className={styles.checkbox}
            />
            <label htmlFor="isActive" className={styles.checkboxLabel}>
              Active (visible to customers)
            </label>
          </div>
        </div>

        {/* Form Actions */}
        <div className={styles.formActions}>
          <button
            type="submit"
            disabled={loading}
            className={styles.submitButton}
          >
            {loading ? (
              <>
                <LoadingSpinner size="small" />
                Creating...
              </>
            ) : (
              'Create Product'
            )}
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

