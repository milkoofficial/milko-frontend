'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminProductsApi } from '@/lib/api';
import { Product, ProductImage, ProductVariation } from '@/types';
import Image from 'next/image';
import styles from './page.module.css';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../../admin-styles.module.css';
import { getAllCategories, Category } from '@/lib/api/categories';
import { useToast } from '@/contexts/ToastContext';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { sanitizeHtml } from '@/lib/utils/sanitizeHtml';

type AdminProductImage = ProductImage & { isMain?: boolean };

function buildAdminImagesFromProduct(data: Product): AdminProductImage[] {
  const sorted = [...(data.images || [])].sort(
    (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)
  );
  const main = data.imageUrl || '';
  const urlsInRows = new Set(sorted.map((i) => i.imageUrl));
  if (main && !urlsInRows.has(main)) {
    return [
      {
        id: 'main',
        productId: data.id,
        imageUrl: main,
        displayOrder: -1,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isMain: true,
      },
      ...sorted,
    ];
  }
  return sorted.map((img, idx) => ({
    ...img,
    isMain: idx === 0,
  }));
}

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
  const [activeTab, setActiveTab] = useState<'details' | 'images' | 'variations'>('details');
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
  const [sellingPrice, setSellingPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [taxPercent, setTaxPercent] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [maxQuantity, setMaxQuantity] = useState('99');
  const [categoryId, setCategoryId] = useState('');
  const [suffixAfterPrice, setSuffixAfterPrice] = useState('Litres');
  const [isActive, setIsActive] = useState(true);
  const [isMembershipEligible, setIsMembershipEligible] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);

  // Images
  const [images, setImages] = useState<AdminProductImage[]>([]);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);

  // Variations
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [newVariation, setNewVariation] = useState({ size: '', price: '', compareAtPrice: '', isAvailable: true });
  const [variationDrafts, setVariationDrafts] = useState<
    Record<string, { price: string; compareAtPrice: string; isAvailable: boolean }>
  >({});
  const [savingVariationId, setSavingVariationId] = useState<string | null>(null);

  // Reviews are managed by customers only (not editable in admin product editor)

  useEffect(() => {
    if (!product) return;
    const next: Record<string, { price: string; compareAtPrice: string; isAvailable: boolean }> = {};
    for (const v of variations) {
      const unit = v.price ?? product.pricePerLitre * v.priceMultiplier;
      next[v.id] = {
        price: String(v.price != null && Number.isFinite(v.price) ? v.price : unit),
        compareAtPrice:
          v.compareAtPrice !== null && v.compareAtPrice !== undefined
            ? String(v.compareAtPrice)
            : '',
        isAvailable: v.isAvailable,
      };
    }
    setVariationDrafts(next);
  }, [product, variations]);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await adminProductsApi.getById(productId);
        setProduct(data);
        setName(data.name);
        setDescription(data.description || '');
        setSellingPrice(data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : '');
        setCompareAtPrice(data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : '');
        setTaxPercent(data.taxPercent !== null && data.taxPercent !== undefined ? String(data.taxPercent) : '');
        setQuantity(String(data.quantity ?? 0));
        setLowStockThreshold(String(data.lowStockThreshold ?? 10));
        setMaxQuantity(String(data.maxQuantity ?? 99));
        setCategoryId(data.categoryId ?? '');
        setSuffixAfterPrice(data.suffixAfterPrice || 'Litres');
        setIsActive(data.isActive);
        setIsMembershipEligible(data.isMembershipEligible || false);

        setImages(buildAdminImagesFromProduct(data));

        setVariations(data.variations || []);
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
      if (variations.length === 0) {
        if (!sellingPrice.trim() || !compareAtPrice.trim()) {
          showToast(
            'Set both Selling Price and Compare At Price, or add variations on the Variations tab.',
            'error'
          );
          return;
        }
        const selling = parseFloat(sellingPrice);
        const compare = parseFloat(compareAtPrice);
        if (Number.isFinite(selling) && Number.isFinite(compare) && selling > compare) {
          showToast('Selling Price cannot be greater than Compare At Price', 'error');
          return;
        }
      }

      const updates: Partial<Product> = {
        name,
        description: sanitizeHtml(description),
        taxPercent: taxPercent ? parseFloat(taxPercent) : 0,
        quantity: quantity ? parseInt(quantity) : 0,
        lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold) : 10,
        maxQuantity: maxQuantity ? parseInt(maxQuantity) : 99,
        categoryId: categoryId || null,
        suffixAfterPrice: suffixAfterPrice || 'Litres',
        isActive,
        isMembershipEligible,
      };

      if (variations.length === 0) {
        updates.sellingPrice = parseFloat(sellingPrice);
        updates.compareAtPrice = parseFloat(compareAtPrice);
        updates.pricePerLitre = parseFloat(sellingPrice);
      }

      await adminProductsApi.update(productId, updates);
      const refreshed = await adminProductsApi.getById(productId);
      setProduct(refreshed);
      setVariations(refreshed.variations || []);
      setSellingPrice(
        refreshed.sellingPrice !== null && refreshed.sellingPrice !== undefined
          ? String(refreshed.sellingPrice)
          : ''
      );
      setCompareAtPrice(
        refreshed.compareAtPrice !== null && refreshed.compareAtPrice !== undefined
          ? String(refreshed.compareAtPrice)
          : ''
      );
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
      await adminProductsApi.addImage(productId, newImageFile);
      const data = await adminProductsApi.getById(productId);
      setProduct(data);
      setImages(buildAdminImagesFromProduct(data));
      setNewImageFile(null);
      const fileInput = document.getElementById('imageInput') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      showToast('Image added', 'success');
    } catch (error) {
      console.error('Failed to add image:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const applyProductFromResponse = (data: Product) => {
    setProduct(data);
    setImages(buildAdminImagesFromProduct(data));
  };

  const persistImageOrder = async (orderedUrls: string[]) => {
    const data = await adminProductsApi.reorderImages(productId, orderedUrls);
    applyProductFromResponse(data);
    showToast('Image order updated', 'success');
  };

  const handleMoveImage = async (index: number, delta: number) => {
    const j = index + delta;
    if (j < 0 || j >= images.length) return;
    const next = [...images];
    [next[index], next[j]] = [next[j], next[index]];
    try {
      await persistImageOrder(next.map((i) => i.imageUrl));
    } catch (error) {
      console.error('Failed to reorder images:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleDeleteImage = async (image: AdminProductImage) => {
    if (!confirm('Are you sure you want to delete this image?')) return;

    try {
      if (image.id === 'main') {
        await adminProductsApi.update(productId, { imageUrl: null });
        const rest = images.filter((i) => i.id !== 'main');
        if (rest.length > 0) {
          const data = await adminProductsApi.reorderImages(productId, rest.map((i) => i.imageUrl));
          applyProductFromResponse(data);
          showToast('Cover image removed. The next image is now the cover.', 'success');
        } else {
          const data = await adminProductsApi.getById(productId);
          applyProductFromResponse(data);
          showToast('Cover image removed', 'success');
        }
        return;
      }

      await adminProductsApi.deleteImage(productId, image.id);
      const data = await adminProductsApi.getById(productId);
      applyProductFromResponse(data);
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
      const priceNum = parseFloat(newVariation.price);
      let compareNum: number | null = null;
      if (newVariation.compareAtPrice.trim()) {
        const c = parseFloat(newVariation.compareAtPrice);
        if (!Number.isFinite(c) || c < 0) {
          showToast('Compare at price must be a valid positive number or empty', 'error');
          return;
        }
        compareNum = c;
      }
      if (compareNum !== null && compareNum < priceNum) {
        showToast('Compare at price must be greater than or equal to the variation price', 'error');
        return;
      }

      await adminProductsApi.addVariation(productId, {
        size: newVariation.size,
        price: priceNum,
        compareAtPrice: compareNum,
        isAvailable: newVariation.isAvailable,
        displayOrder: variations.length,
      });
      const data = await adminProductsApi.getById(productId);
      setProduct(data);
      setVariations(data.variations || []);
      setSellingPrice(
        data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : ''
      );
      setCompareAtPrice(
        data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : ''
      );
      setNewVariation({ size: '', price: '', compareAtPrice: '', isAvailable: true });
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
      const data = await adminProductsApi.getById(productId);
      setProduct(data);
      setVariations(data.variations || []);
      setSellingPrice(
        data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : ''
      );
      setCompareAtPrice(
        data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : ''
      );
      showToast('Variation deleted', 'success');
    } catch (error) {
      console.error('Failed to delete variation:', error);
      showToast(getErrorMessage(error), 'error');
    }
  };

  const handleSaveVariation = async (variationId: string) => {
    const d = variationDrafts[variationId];
    if (!d) return;
    const price = parseFloat(d.price);
    if (!Number.isFinite(price) || price < 0) {
      showToast('Enter a valid selling price for this variation', 'error');
      return;
    }
    let comparePayload: number | null = null;
    if (d.compareAtPrice.trim() !== '') {
      const c = parseFloat(d.compareAtPrice);
      if (!Number.isFinite(c) || c < 0) {
        showToast('Compare at price must be a valid number or empty', 'error');
        return;
      }
      comparePayload = c;
    }
    if (comparePayload !== null && comparePayload < price) {
      showToast('Compare at price must be greater than or equal to the variation price', 'error');
      return;
    }

    setSavingVariationId(variationId);
    try {
      await adminProductsApi.updateVariation(productId, variationId, {
        price,
        compareAtPrice: comparePayload,
        isAvailable: d.isAvailable,
      });
      const data = await adminProductsApi.getById(productId);
      setProduct(data);
      setVariations(data.variations || []);
      setSellingPrice(
        data.sellingPrice !== null && data.sellingPrice !== undefined ? String(data.sellingPrice) : ''
      );
      setCompareAtPrice(
        data.compareAtPrice !== null && data.compareAtPrice !== undefined ? String(data.compareAtPrice) : ''
      );
      showToast('Variation saved', 'success');
    } catch (error) {
      console.error('Failed to update variation:', error);
      showToast(getErrorMessage(error), 'error');
    } finally {
      setSavingVariationId(null);
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
            {variations.length > 0 ? (
              <div className={styles.formGroup}>
                <div
                  style={{
                    padding: '0.75rem 1rem',
                    background: '#eff6ff',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                  }}
                >
                  <strong>Pricing:</strong> This product uses size variations. Set selling and compare-at per size on
                  the Variations tab. Product-level selling/compare-at here are cleared while variations exist. To use
                  one fixed price for the whole product, remove all variations first, then set both prices here and
                  save.
                </div>
              </div>
            ) : (
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
                      placeholder="Required"
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
                      placeholder="Required"
                    />
                  </div>
                </div>
              </div>
            )}
            <div className={styles.formRow}>
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Tax (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={taxPercent}
                    onChange={(e) => setTaxPercent(e.target.value)}
                    className={styles.input}
                    placeholder="0"
                  />
                </div>
              </div>
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
              <div style={{ flex: 1 }}>
                <div className={styles.formGroup}>
                  <label>Max Quantity Per Order</label>
                  <input
                    type="number"
                    min="1"
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(e.target.value)}
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
            <div className={styles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  checked={isMembershipEligible}
                  onChange={(e) => setIsMembershipEligible(e.target.checked)}
                />
                Eligible for Membership (show in membership section)
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
            <p className={styles.imagesHint}>
              The first image is the cover (product cards and first slide in the customer gallery). Use Up / Down to change order.
              New uploads are added without removing existing images.
            </p>
            <div className={styles.imageGrid}>
              {images.map((image, index) => (
                <div key={`${image.id}-${index}`} className={styles.imageCard}>
                  {index === 0 && (
                    <div className={`${styles.imageBadge} ${styles.imageBadgeMain}`}>Cover</div>
                  )}
                  <Image
                    src={image.imageUrl}
                    alt="Product image"
                    width={200}
                    height={200}
                    style={{ objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <div className={styles.imageCardActions}>
                    <button
                      type="button"
                      className={styles.reorderButton}
                      disabled={index === 0}
                      onClick={() => handleMoveImage(index, -1)}
                      aria-label="Move image up"
                    >
                      ↑ Up
                    </button>
                    <button
                      type="button"
                      className={styles.reorderButton}
                      disabled={index === images.length - 1}
                      onClick={() => handleMoveImage(index, 1)}
                      aria-label="Move image down"
                    >
                      ↓ Down
                    </button>
                    <button type="button" onClick={() => handleDeleteImage(image)} className={styles.deleteButton}>
                      Delete
                    </button>
                  </div>
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
              {variations.map((variation) => {
                const draft = variationDrafts[variation.id];
                return (
                  <div key={variation.id} className={styles.variationCard}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{variation.size}</strong>
                      {draft ? (
                        <div
                          className={styles.formRow}
                          style={{ marginTop: '0.75rem', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'flex-end' }}
                        >
                          <div className={styles.formGroup} style={{ marginBottom: 0, minWidth: '120px' }}>
                            <label style={{ fontSize: '0.8rem' }}>Price (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={draft.price}
                              onChange={(e) =>
                                setVariationDrafts((prev) => ({
                                  ...prev,
                                  [variation.id]: { ...prev[variation.id], price: e.target.value },
                                }))
                              }
                              className={styles.input}
                            />
                          </div>
                          <div className={styles.formGroup} style={{ marginBottom: 0, minWidth: '140px' }}>
                            <label style={{ fontSize: '0.8rem' }}>Compare at (₹)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={draft.compareAtPrice}
                              onChange={(e) =>
                                setVariationDrafts((prev) => ({
                                  ...prev,
                                  [variation.id]: { ...prev[variation.id], compareAtPrice: e.target.value },
                                }))
                              }
                              className={styles.input}
                              placeholder="Optional"
                            />
                          </div>
                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.35rem',
                              fontSize: '0.85rem',
                              marginBottom: '0.35rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={draft.isAvailable}
                              onChange={(e) =>
                                setVariationDrafts((prev) => ({
                                  ...prev,
                                  [variation.id]: { ...prev[variation.id], isAvailable: e.target.checked },
                                }))
                              }
                            />
                            Available
                          </label>
                          <button
                            type="button"
                            onClick={() => handleSaveVariation(variation.id)}
                            className={styles.addButton}
                            disabled={savingVariationId === variation.id}
                          >
                            {savingVariationId === variation.id ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteVariation(variation.id)}
                      className={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
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
                  style={{ width: '130px' }}
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Compare at (₹)"
                  value={newVariation.compareAtPrice}
                  onChange={(e) => setNewVariation({ ...newVariation, compareAtPrice: e.target.value })}
                  className={styles.input}
                  style={{ width: '140px' }}
                  title="Optional strikethrough price for discounts"
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

      </div>
    </div>
  );
}

