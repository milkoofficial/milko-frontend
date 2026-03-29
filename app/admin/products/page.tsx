'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { adminProductsApi } from '@/lib/api';
import { Product } from '@/types';
import Link from 'next/link';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { getAllCategories, Category } from '@/lib/api/categories';
import { useToast } from '@/contexts/ToastContext';

/**
 * Admin Products Page
 * Manage all products (create, edit, delete)
 */
export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sort, setSort] = useState<'updatedDesc' | 'nameAsc' | 'priceAsc' | 'priceDesc'>('updatedDesc');
  const { showToast } = useToast();

  const getErrorMessage = (err: unknown) => {
    if (typeof err === 'string') return err;
    if (err && typeof err === 'object' && 'message' in err) {
      const maybe = (err as { message?: unknown }).message;
      if (typeof maybe === 'string') return maybe;
    }
    return 'Something went wrong';
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const data = await adminProductsApi.getAll();
        setProducts(data);
      } catch (error) {
        console.error('Failed to fetch products:', error);
        showToast(getErrorMessage(error), 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [showToast]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getAllCategories();
        setCategories(data);
      } catch (error) {
        // Non-blocking; products list can still load without category labels.
        console.warn('Failed to fetch categories:', error);
      }
    };

    fetchCategories();
  }, []);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const getPrimaryPrice = (p: Product) => {
    const selling = p.sellingPrice;
    if (selling !== null && selling !== undefined) return selling;
    return p.pricePerLitre;
  };

  const filtered = products
    .filter((p) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    })
    .filter((p) => {
      if (statusFilter === 'all') return true;
      return statusFilter === 'active' ? p.isActive : !p.isActive;
    })
    .sort((a, b) => {
      if (sort === 'nameAsc') return a.name.localeCompare(b.name);
      if (sort === 'priceAsc') return getPrimaryPrice(a) - getPrimaryPrice(b);
      if (sort === 'priceDesc') return getPrimaryPrice(b) - getPrimaryPrice(a);
      // updatedDesc default
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        padding: '2rem'
      }}>
        <LoadingSpinnerWithText text="Loading products..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={adminStyles.adminPageTitle}>Products</h1>
          <div className={styles.subtitle}>
            {filtered.length} product{filtered.length !== 1 ? 's' : ''} shown
            {products.length !== filtered.length ? ` (filtered from ${products.length})` : ''}
          </div>
        </div>
        <Link href="/admin/products/new" className={adminStyles.adminButton}>
          Add Product
        </Link>
      </div>

      <div className={styles.toolbar}>
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
            placeholder="Search by name or description…"
          />
        </div>

        <CustomSelect<'all' | 'active' | 'inactive'>
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />

        <CustomSelect<'updatedDesc' | 'nameAsc' | 'priceAsc' | 'priceDesc'>
          value={sort}
          onChange={setSort}
          options={[
            { value: 'updatedDesc', label: 'Sort: Recently updated' },
            { value: 'nameAsc', label: 'Sort: Name (A → Z)' },
            { value: 'priceAsc', label: 'Sort: Price (low → high)' },
            { value: 'priceDesc', label: 'Sort: Price (high → low)' },
          ]}
        />
      </div>

      {/* Desktop table */}
      <div className={styles.panel}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            No products found. Try clearing filters or create a new product.
          </div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Product</th>
                <th className={styles.th}>Price</th>
                <th className={styles.th}>Stock</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Updated</th>
                <th className={styles.th} style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const suffix = product.suffixAfterPrice || 'Litres';
                const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Category') : 'Uncategorized';
                const qty = product.quantity ?? null;
                const low = product.lowStockThreshold ?? null;
                const isLowStock = qty !== null && low !== null && qty <= low;
                const primary = getPrimaryPrice(product);
                const compare = product.compareAtPrice;

                return (
                  <tr key={product.id} className={styles.row}>
                    <td className={styles.td}>
                      <div className={styles.productCell}>
                        <div className={styles.thumb}>
                          {product.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <span className={styles.thumbText}>{product.name.slice(0, 1).toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className={styles.productName}>{product.name}</div>
                          <div className={styles.productMeta}>
                            {categoryLabel} • ID #{product.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div className={styles.priceBlock}>
                        <div className={styles.priceMain}>
                          ₹{primary.toFixed(2)}/{suffix}
                          {compare !== null && compare !== undefined && compare > primary ? (
                            <span className={styles.strike}>₹{compare.toFixed(2)}</span>
                          ) : null}
                        </div>
                        <div className={styles.priceSub}>Base: ₹{product.pricePerLitre.toFixed(2)}</div>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, color: '#0f172a' }}>
                          {qty === null ? '—' : qty}
                        </span>
                        {isLowStock ? <span className={`${styles.badge} ${styles.badgeLowStock}`}>Low</span> : null}
                      </div>
                      <div className={styles.priceSub}>
                        Threshold: {low === null ? '—' : low}
                      </div>
                    </td>
                    <td className={styles.td}>
                      <span className={`${styles.badge} ${product.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                        {product.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={styles.td}>
                      {new Date(product.updatedAt).toLocaleDateString()}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actions}>
                        <Link className={styles.linkButton} href={`/admin/products/${product.id}`}>
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile cards */}
      <div className={styles.cards}>
        {filtered.length === 0 ? (
          <div className={styles.card}>
            <div className={styles.emptyState} style={{ padding: '1rem' }}>
              No products found.
            </div>
          </div>
        ) : (
          filtered.map((product) => {
            const suffix = product.suffixAfterPrice || 'Litres';
            const categoryLabel = product.categoryId ? (categoryMap.get(product.categoryId) || 'Category') : 'Uncategorized';
            const qty = product.quantity ?? null;
            const low = product.lowStockThreshold ?? null;
            const isLowStock = qty !== null && low !== null && qty <= low;
            const primary = getPrimaryPrice(product);
            const compare = product.compareAtPrice;

            return (
              <div className={styles.card} key={product.id}>
                <div className={styles.cardTop}>
                  <div className={styles.cardTitleRow}>
                    <div className={styles.thumb}>
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span className={styles.thumbText}>{product.name.slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className={styles.productName}>{product.name}</div>
                      <div className={styles.productMeta}>{categoryLabel} • #{product.id}</div>
                    </div>
                  </div>
                  <span className={`${styles.badge} ${product.isActive ? styles.badgeActive : styles.badgeInactive}`}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>PRICE</div>
                    <div className={styles.kvValue}>
                      ₹{primary.toFixed(2)}/{suffix}
                      {compare !== null && compare !== undefined && compare > primary ? (
                        <span className={styles.strike}>₹{compare.toFixed(2)}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>STOCK</div>
                    <div className={styles.kvValue}>
                      {qty === null ? '—' : qty}
                      {isLowStock ? <span className={`${styles.badge} ${styles.badgeLowStock}`}>Low</span> : null}
                    </div>
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>UPDATED</div>
                    <div className={styles.kvValue}>{new Date(product.updatedAt).toLocaleDateString()}</div>
                  </div>
                  <div className={styles.kv}>
                    <div className={styles.kvLabel}>ACTIONS</div>
                    <Link className={styles.linkButton} href={`/admin/products/${product.id}`}>
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CustomSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (next: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (e.target instanceof Node && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
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
                {isActive ? <span className={styles.dropdownHint}>Selected</span> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

