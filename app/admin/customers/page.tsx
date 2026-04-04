'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadingSpinnerWithText } from '@/components/ui/LoadingSpinner';
import adminStyles from '../admin-styles.module.css';
import styles from './page.module.css';
import { apiClient } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

type CustomerRow = {
  id: string;
  name: string;
  email: string;
  orders: number;
  amountSpent: number;
  location: string | null;
};

type SortKey = 'nameAsc' | 'ordersDesc' | 'spentDesc';

/**
 * Admin Customers Page
 * Customer analytics
 */
export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('nameAsc');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchExpandRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await apiClient.get<CustomerRow[]>('/api/admin/customers');
        setCustomers(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to fetch customers:', error);
        setCustomers([]);
        showToast((error as { message?: string })?.message || 'Failed to fetch customers', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [showToast]);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = customers.filter((c) => {
      if (!q) return true;
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.location || '').toLowerCase().includes(q)
      );
    });
    list = [...list].sort((a, b) => {
      if (sort === 'nameAsc') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'ordersDesc') return b.orders - a.orders;
      return (b.amountSpent || 0) - (a.amountSpent || 0);
    });
    return list;
  }, [customers, query, sort]);

  const initial = (name: string) => {
    const t = (name || '?').trim();
    return t ? t.slice(0, 1).toUpperCase() : '?';
  };

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          padding: '2rem',
        }}
      >
        <LoadingSpinnerWithText text="Loading customers..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={adminStyles.adminPageTitle}>Customers</h1>
          <div className={styles.subtitle}>
            {filtered.length} customer{filtered.length !== 1 ? 's' : ''} shown
            {customers.length !== filtered.length ? ` (of ${customers.length})` : ''}
          </div>
        </div>
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
              placeholder="Search by name, email, or location…"
              aria-label="Search customers"
            />
          </div>
        </div>

        <div className={styles.filterSlot}>
          <CustomSelect<SortKey>
            value={sort}
            onChange={setSort}
            modalTitle="Sort"
            options={[
              { value: 'nameAsc', label: 'Sort: Name (A → Z)' },
              { value: 'ordersDesc', label: 'Sort: Orders (high → low)' },
              { value: 'spentDesc', label: 'Sort: Amount spent (high → low)' },
            ]}
          />
        </div>
      </div>

      <div className={styles.panel}>
        {filtered.length === 0 ? (
          <div className={styles.emptyState}>
            {customers.length === 0
              ? 'No customers found.'
              : 'No customers match your search. Try a different term.'}
          </div>
        ) : (
          <table className={styles.table}>
            <thead className={styles.thead}>
              <tr>
                <th className={styles.th}>Customer</th>
                <th className={styles.th}>Email</th>
                <th className={styles.th}>Orders</th>
                <th className={styles.th}>Amount Spent</th>
                <th className={styles.th}>Location</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr key={customer.id} className={styles.row}>
                  <td className={styles.td}>
                    <div className={styles.customerName}>{customer.name}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.customerEmail}>{customer.email}</div>
                  </td>
                  <td className={styles.td}>{customer.orders}</td>
                  <td className={styles.td}>
                    <span className={styles.amountCell}>₹{(customer.amountSpent || 0).toFixed(2)}</span>
                  </td>
                  <td className={styles.td}>{customer.location || '—'}</td>
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
              {customers.length === 0 ? 'No customers found.' : 'No customers match your search.'}
            </div>
          </div>
        ) : (
          filtered.map((customer) => (
            <div className={styles.card} key={customer.id}>
              <div className={styles.cardTop}>
                <div className={styles.avatar} aria-hidden="true">
                  {initial(customer.name)}
                </div>
                <div className={styles.cardTitleBlock}>
                  <div className={styles.customerName}>{customer.name}</div>
                  <div className={styles.customerEmail}>{customer.email}</div>
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.kv}>
                  <div className={styles.kvLabel}>ORDERS</div>
                  <div className={styles.kvValue}>{customer.orders}</div>
                </div>
                <div className={styles.kv}>
                  <div className={styles.kvLabel}>SPENT</div>
                  <div className={styles.kvValue}>₹{(customer.amountSpent || 0).toFixed(2)}</div>
                </div>
                <div className={`${styles.kv} ${styles.kvWide}`}>
                  <div className={styles.kvLabel}>LOCATION</div>
                  <div className={styles.kvValue}>{customer.location || '—'}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
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
