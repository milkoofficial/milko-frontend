'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { cartStorage, CartItem } from '@/lib/utils/cart';
import { productsApi } from '@/lib/api';
import { Product } from '@/types';

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});

  useEffect(() => {
    setItems(cartStorage.get());
  }, []);

  useEffect(() => {
    const load = async () => {
      const unique = Array.from(new Set(items.map((i) => i.productId)));
      const entries = await Promise.all(
        unique.map(async (id) => {
          try {
            const p = await productsApi.getById(id, true);
            return [id, p] as const;
          } catch {
            return [id, null] as const;
          }
        })
      );
      const map: Record<string, Product> = {};
      for (const [id, p] of entries) {
        if (p) map[id] = p;
      }
      setProducts(map);
    };
    if (items.length) load();
  }, [items]);

  const total = useMemo(() => {
    return items.reduce((sum, it) => {
      const p = products[it.productId];
      if (!p) return sum;
      const v = it.variationId ? (p.variations || []).find((x) => x.id === it.variationId) : null;
      const mult = v?.priceMultiplier ?? 1;
      return sum + p.pricePerLitre * mult * it.quantity;
    }, 0);
  }, [items, products]);

  if (items.length === 0) {
    return (
      <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem' }}>Cart</h1>
        <p style={{ color: '#666', marginBottom: '1.5rem' }}>Your cart is empty.</p>
        <Link href="/" style={{ color: '#0070f3', fontWeight: 700 }}>Continue shopping →</Link>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>Cart</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {items.map((it) => {
          const p = products[it.productId];
          const v = it.variationId ? (p?.variations || []).find((x) => x.id === it.variationId) : null;
          return (
            <div
              key={`${it.productId}:${it.variationId || ''}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '1rem',
                border: '1px solid #e5e5e5',
                borderRadius: 12,
                background: '#fff',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800 }}>{p ? p.name : 'Loading...'}</div>
                {p && (
                  <div style={{ color: '#666', marginTop: 4 }}>
                    ₹{p.pricePerLitre}
                    {v ? ` × ${v.priceMultiplier} (${v.size})` : ''} / unit
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <input
                  value={it.quantity}
                  inputMode="numeric"
                  onChange={(e) => {
                    const n = parseInt(e.target.value || '1', 10);
                    cartStorage.setQuantity(it.productId, Number.isFinite(n) ? n : 1, it.variationId);
                    setItems(cartStorage.get());
                  }}
                  style={{
                    width: 64,
                    padding: '0.5rem',
                    border: '1px solid #ddd',
                    borderRadius: 10,
                    textAlign: 'center',
                    fontWeight: 800,
                  }}
                  aria-label="Quantity"
                />

                <button
                  onClick={() => {
                    cartStorage.remove(it.productId, it.variationId);
                    setItems(cartStorage.get());
                  }}
                  style={{
                    border: '1px solid #ffdddd',
                    background: '#fff5f5',
                    color: '#d32f2f',
                    padding: '0.5rem 0.75rem',
                    borderRadius: 10,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Remove
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900 }}>
          <span>Total</span>
          <span>₹{total.toFixed(2)}</span>
        </div>
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <Link
            href="/"
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.9rem 1rem',
              border: '1.5px solid #0070f3',
              borderRadius: 12,
              color: '#0070f3',
              fontWeight: 900,
            }}
          >
            Continue shopping
          </Link>
          <Link
            href="/subscribe"
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '0.9rem 1rem',
              border: '1.5px solid #0070f3',
              borderRadius: 12,
              background: '#0070f3',
              color: '#fff',
              fontWeight: 900,
            }}
          >
            Checkout (Subscribe)
          </Link>
        </div>
      </div>
    </div>
  );
}


