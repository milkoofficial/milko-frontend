'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminProductsApi } from '@/lib/api';
import { Product, ProductImage, ProductVariation, ProductReview } from '@/types';
import Image from 'next/image';
import styles from './page.module.css';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../../admin-styles.module.css';
import { getAllCategories, Category } from '@/lib/api/categories';
import { useToast } from '@/contexts/ToastContext';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';

type AdminProductImage = ProductImage & { isMain?: boolean };

/**
 * Admin Product Edit Page
 * Edit product details, images, variations, and reviews
 */
export default function AdminProductEditPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'images' | 'variations' | 'reviews'>('details');
  const { showToast } = useToast();

  const getErrorMessage = (err: unknown) => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
      const maybe = (err as { message?: unknown }).message;
      if (typeof maybe === 'string') return maybe;
    }
    return 'Something went wrong';
  };

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pricePerLitre, setPricePerLitre] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [categoryId, setCategoryId] = useState('');
  const [suffixAfterPrice, setSuffixAfterPrice] = useState('Litres');
  const [isActive, setIsActive] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  // Images
  const [images, setImages] = useState<AdminProductImage[]>([]);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);

  // Variations
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [newVariation, setNewVariation] = useState({ size: '', price: '', isAvailable: true });

  // Reviews
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [newReview, setNewReview] = useState({ reviewerName: '', rating: 5, comment: '', isApproved: true });

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await adminProductsApi.getById(productId);
        setProduct(data);
        setName(data.name);
        setDescription(data.description || '');
        setPricePerLitre(data.pricePerLitre.toString());
        setSellingPrice(data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : '');
        setCompareAtPrice(data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : '');
        setQuantity(String(data.quantity ?? 0));
        setLowStockThreshold(String(data.lowStockThreshold ?? 10));
        setCategoryId(data.categoryId ?? '');
        setSuffixAfterPrice(data.suffixAfterPrice || 'Litres');
        setIsActive(data.isActive);

        // On create, the first image is stored on the product row (data.imageUrl).
        // Additional images are stored in product_images (data.images).
        // Show both on the edit page.
        const dbImages: AdminProductImage[] = (data.images || []) as AdminProductImage[];
        const mainImageUrl = data.imageUrl;
        const combinedImages = [...dbImages];
        if (mainImageUrl && !combinedImages.some(img => img.imageUrl === mainImageUrl)) {
          combinedImages.unshift({
            id: 'main',
            productId: data.id,
            imageUrl: mainImageUrl,
            displayOrder: -1,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            isMain: true,
          });
        }
        setImages(combinedImages);

        setVariations(data.variations || []);
        setReviews(data.reviews || []);
      } catch (error) {
        console.error('Failed to fetch product:', error);
        showToast(getErrorMessage(error), 'error');
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      fetchProduct();
    }
  }, [productId, showToast]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getAllCategories();
        setCategories(data);
      } catch (error) {
        // Non-blocking
        console.warn('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
  }, []);

  const handleSaveProduct = async () => {
    setSaving(true);
    try {
      if (sellingPrice && compareAtPrice) {
        const selling = parseFloat(sellingPrice);
        const compare = parseFloat(compareAtPrice);
        if (Number.isFinite(selling) && Number.isFinite(compare) && selling > compare) {
          showToast('Selling Price cannot be greater than Compare At Price', 'error');
          return;
        }
      }

      await adminProductsApi.update(productId, {
        name,
        description: sanitizeHtml(description),
        pricePerLitre: parseFloat(pricePerLitre),
        sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
        compareAtPrice: compareAtPrice ? parseFloat(compareAtPrice) : null,
        quantity: quantity ? parseInt(quantity) : 0,
        lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold) : 10,
        categoryId: categoryId || null,
        suffixAfterPrice: suffixAfterPrice || 'Litres',
        isActive,
      });
      showToast('Product updated successfully', 'success');
    } catch (error) {
      console.error('Failed to update product:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddImage = async () => {
    if (!newImageFile) return;

    try {
      const image = await adminProductsApi.addImage(productId, newImageFile, images.length);
      setImages([...images, image as AdminProductImage]);
      setNewImageFile(null);
      // Reset file input
      const fileInput = document.getElementById('imageInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (error) {
      console.error('Failed to add image:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDeleteImage = async (imageId: string) => {
    if (imageId === 'main') return; // main image isn't stored in product_images
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      await adminProductsApi.deleteImage(productId, imageId);
      setImages(images.filter(img => img.id !== imageId));
      showToast('Image deleted', 'success');
    } catch (error) {
      console.error('Failed to delete image:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleAddVariation = async () => {
    if (!newVariation.size) {
      showToast('Please enter a size', 'error');
      return;
    }
    if (!newVariation.price) {
      showToast('Please enter a price', 'error');
      return;
    }

    try {
      const variation = await adminProductsApi.addVariation(productId, {
        size: newVariation.size,
        price: parseFloat(newVariation.price),
        isAvailable: newVariation.isAvailable,
        displayOrder: variations.length,
      });
      setVariations([...variations, variation]);
      setNewVariation({ size: '', price: '', isAvailable: true });
      showToast('Variation added', 'success');
    } catch (error) {
      console.error('Failed to add variation:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDeleteVariation = async (variationId: string) => {
    if (!confirm('Are you sure you want to delete this variation?')) return;

    try {
      await adminProductsApi.deleteVariation(productId, variationId);
      setVariations(variations.filter(v => v.id !== variationId));
      showToast('Variation deleted', 'success');
    } catch (error) {
      console.error('Failed to delete variation:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleAddReview = async () => {
    if (!newReview.reviewerName || !newReview.rating) {
      showToast('Please enter reviewer name and rating', 'error');
      return;
    }

    try {
      const review = await adminProductsApi.addReview(productId, {
        reviewerName: newReview.reviewerName,
        rating: newReview.rating,
        comment: newReview.comment || undefined,
        isApproved: newReview.isApproved,
      });
      setReviews([...reviews, review]);
      setNewReview({ reviewerName: '', rating: 5, comment: '', isApproved: true });
      showToast('Review added', 'success');
    } catch (error) {
      console.error('Failed to add review:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
      await adminProductsApi.deleteReview(productId, reviewId);
      setReviews(reviews.filter(r => r.id !== reviewId));
      showToast('Review deleted', 'success');
    } catch (error) {
      console.error('Failed to delete review:', error);
      showToast(getErrorMessage(error), 'error');
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
        <LoadingSpinnerWithText text="Loading product..." />
      </div>
    );
  }

  if (!product) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Product not found</p>
            <button onClick={() => router.push('/admin/products')} className={styles.backButton}>
              ← Back to Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button onClick={() => router.back()} className={styles.backButton}>
          ← Back
        </button>
        <h1 className={adminStyles.adminPageTitle}>Edit Product: {product.name}</h1>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={activeTab === 'details' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('details')}
        >
          Product Details
        </button>
        <button
          className={activeTab === 'images' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('images')}
        >
          Images ({images.length})
        </button>
        <button
          className={activeTab === 'variations' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('variations')}
        >
          Variations ({variations.length})
        </button>
        <button
          className={activeTab === 'reviews' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews ({reviews.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {/* Product Details Tab */}
        {activeTab === 'details' && (
          <div className={styles.section}>
            <h2>Product Information</h2>
            <div className={styles.formGroup}>
              <label>Product Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Description</label>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Describe your product..."
              />
            </div>
            <div className={styles.formGroup}>
              <label>Price per Litre (₹)</label>
              <input
                type="number"
                step="0.01"
                value={pricePerLitre}
                onChange={(e) => setPricePerLitre(e.target.value)}
                className={styles.input}
              />
            </div>
            <div className={styles.formRow}>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className={styles.input}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Compare At Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={compareAtPrice}
                    onChange={(e) => setCompareAtPrice(e.target.value)}
                    className={styles.input}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
            <div className={styles.formRow}>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Low Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                    className={styles.input}
                  />
                </div>
              </div>
            </div>
            <div className={styles.formRow}>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className={styles.input}
                  >
                    <option value="">No Category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Suffix After Price</label>
                  <input
                    type="text"
                    value={suffixAfterPrice}
                    onChange={(e) => setSuffixAfterPrice(e.target.value)}
                    className={styles.input}
                    placeholder="Litres"
                  />
                </div>
              </div>
            </div>
            <div className={styles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                Active (visible to customers)
              </label>
            </div>
            <button
              onClick={handleSaveProduct}
              disabled={saving}
              className={styles.saveButton}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Images Tab */}
        {activeTab === 'images' && (
          <div className={styles.section}>
            <h2>Product Images</h2>
            <div className={styles.imageGrid}>
              {images.map((image) => (
                <div key={image.id} className={styles.imageCard}>
                  {image.isMain && (
                    <div className={`${styles.imageBadge} ${styles.imageBadgeMain}`}>
                      Main
                    </div>
                  )}
                  <Image
                    src={image.imageUrl}
                    alt="Product image"
                    width={200}
                    height={200}
                    style={{ objectFit: 'cover', borderRadius: '8px' }}
                  />
                  {!image.isMain && (
                    <button
                      onClick={() => handleDeleteImage(image.id)}
                      className={styles.deleteButton}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className={styles.addSection}>
              <h3>Add New Image</h3>
              <input
                id="imageInput"
                type="file"
                accept="image/*"
                onChange={(e) => setNewImageFile(e.target.files?.[0] || null)}
                className={styles.fileInput}
              />
              <button
                onClick={handleAddImage}
                disabled={!newImageFile}
                className={styles.addButton}
              >
                Add Image
              </button>
            </div>
          </div>
        )}

        {/* Variations Tab */}
        {activeTab === 'variations' && (
          <div className={styles.section}>
            <h2>Product Variations (Sizes)</h2>
            <div className={styles.variationsList}>
              {variations.map((variation) => (
                <div key={variation.id} className={styles.variationCard}>
                  <div>
                    <strong>{variation.size}</strong>
                    <div style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                      Price: ₹{(variation.price ?? (product.pricePerLitre * variation.priceMultiplier)).toFixed(2)}
                      {variation.price === undefined && variation.priceMultiplier !== 1 && ` (${variation.priceMultiplier}x)`}
                    </div>
                    <div style={{ color: variation.isAvailable ? '#28a745' : '#dc3545', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                      {variation.isAvailable ? 'Available' : 'Not Available'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteVariation(variation.id)}
                    className={styles.deleteButton}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.addSection}>
              <h3>Add New Variation</h3>
              <div className={styles.formRow}>
                <input
                  type="text"
                  placeholder="Size (e.g., 0.5L, 1L, 2L)"
                  value={newVariation.size}
                  onChange={(e) => setNewVariation({ ...newVariation, size: e.target.value })}
                  className={styles.input}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Price (₹)"
                  value={newVariation.price}
                  onChange={(e) => setNewVariation({ ...newVariation, price: e.target.value })}
                  className={styles.input}
                  style={{ width: '150px' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={newVariation.isAvailable}
                    onChange={(e) => setNewVariation({ ...newVariation, isAvailable: e.target.checked })}
                  />
                  Available
                </label>
              </div>
              <button
                onClick={handleAddVariation}
                className={styles.addButton}
              >
                Add Variation
              </button>
            </div>
          </div>
        )}

        {/* Reviews Tab */}
        {activeTab === 'reviews' && (
          <div className={styles.section}>
            <h2>Product Reviews</h2>
            <div className={styles.reviewsList}>
              {reviews.map((review) => (
                <div key={review.id} className={styles.reviewCard}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                      <strong>{review.reviewerName}</strong>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} style={{ color: star <= review.rating ? '#ffc107' : '#ddd' }}>
                            ★
                          </span>
                        ))}
                      </div>
                      {!review.isApproved && (
                        <span style={{ background: '#ffc107', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>
                          Pending Approval
                        </span>
                      )}
                    </div>
                    {review.comment && (
                      <p style={{ color: '#666', marginTop: '0.5rem' }}>{review.comment}</p>
                    )}
                    <div style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                      {new Date(review.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteReview(review.id)}
                    className={styles.deleteButton}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
            <div className={styles.addSection}>
              <h3>Add New Review</h3>
              <div className={styles.formGroup}>
                <label>Reviewer Name</label>
                <input
                  type="text"
                  value={newReview.reviewerName}
                  onChange={(e) => setNewReview({ ...newReview, reviewerName: e.target.value })}
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Rating (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={newReview.rating}
                  onChange={(e) => setNewReview({ ...newReview, rating: parseInt(e.target.value) })}
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label>Comment</label>
                <textarea
                  value={newReview.comment}
                  onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  className={styles.textarea}
                  rows={3}
                />
              </div>
              <div className={styles.formGroup}>
                <label>
                  <input
                    type="checkbox"
                    checked={newReview.isApproved}
                    onChange={(e) => setNewReview({ ...newReview, isApproved: e.target.checked })}
                  />
                  Approved (visible to customers)
                </label>
              </div>
              <button
                onClick={handleAddReview}
                className={styles.addButton}
              >
                Add Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

