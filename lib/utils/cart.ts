import { scopedCartKey } from '@/lib/utils/userScopedStorage';

export interface CartItem {
  productId: string;
  variationId?: string;
  quantity: number;
}

const LEGACY_CART_KEY = 'milko_cart_v1';

function safeParse(json: string | null): CartItem[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is CartItem => !!x && typeof x === 'object')
      .map((x: any) => ({
        productId: String(x.productId ?? ''),
        variationId: x.variationId ? String(x.variationId) : undefined,
        quantity: Number(x.quantity ?? 1),
      }))
      .filter((x) => x.productId && Number.isFinite(x.quantity) && x.quantity > 0);
  } catch {
    return [];
  }
}

function readRaw(key: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(key));
}

function writeRaw(key: string, items: CartItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(items));
}

/**
 * Cart storage scoped by logged-in user id (guest uses a separate key).
 */
export function getCartStorage(userId: string | null) {
  const storageKey = scopedCartKey(userId);

  function read(): CartItem[] {
    let items = readRaw(storageKey);
    if (items.length === 0 && !userId && typeof window !== 'undefined') {
      const legacy = window.localStorage.getItem(LEGACY_CART_KEY);
      if (legacy) {
        items = safeParse(legacy);
        writeRaw(storageKey, items);
        window.localStorage.removeItem(LEGACY_CART_KEY);
      }
    }
    return items;
  }

  return {
    storageKey,

    get(): CartItem[] {
      return read();
    },

    add(item: CartItem) {
      const qty = Math.max(1, Math.min(99, item.quantity));
      const items = read();
      const idx = items.findIndex(
        (x) => x.productId === item.productId && (x.variationId || '') === (item.variationId || ''),
      );
      if (idx >= 0) {
        items[idx] = { ...items[idx], quantity: Math.min(99, items[idx].quantity + qty) };
      } else {
        items.push({ productId: item.productId, variationId: item.variationId, quantity: qty });
      }
      writeRaw(storageKey, items);
    },

    setQuantity(productId: string, quantity: number, variationId?: string) {
      const qty = Math.max(1, Math.min(99, quantity));
      const items = read().map((x) =>
        x.productId === productId && (x.variationId || '') === (variationId || '') ? { ...x, quantity: qty } : x,
      );
      writeRaw(storageKey, items);
    },

    remove(productId: string, variationId?: string) {
      const items = read().filter(
        (x) => !(x.productId === productId && (x.variationId || '') === (variationId || '')),
      );
      writeRaw(storageKey, items);
    },

    clear() {
      writeRaw(storageKey, []);
    },
  };
}
