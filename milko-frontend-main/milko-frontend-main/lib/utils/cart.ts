import { scopedCartKey } from '@/lib/utils/userScopedStorage';

export interface CartItem {
  productId: string;
  variationId?: string;
  quantity: number;
}

export interface CartMutationResult {
  ok: boolean;
  quantity: number;
  appliedQuantity: number;
  reachedMax: boolean;
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

function getProductTotal(items: CartItem[], productId: string) {
  return items.reduce((sum, item) => (item.productId === productId ? sum + item.quantity : sum), 0);
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

    add(item: CartItem, maxQuantity?: number): CartMutationResult {
      const qty = Math.max(1, Math.min(99, item.quantity));
      const items = read();
      const effectiveMax =
        Number.isFinite(maxQuantity) && Number(maxQuantity) > 0
          ? Math.max(1, Math.min(99, Number(maxQuantity)))
          : 99;
      const currentTotal = getProductTotal(items, item.productId);
      const remaining = Math.max(0, effectiveMax - currentTotal);
      const appliedQuantity = Math.min(qty, remaining);
      const idx = items.findIndex(
        (x) => x.productId === item.productId && (x.variationId || '') === (item.variationId || ''),
      );
      if (appliedQuantity <= 0) {
        const existingQty = idx >= 0 ? items[idx].quantity : 0;
        return {
          ok: false,
          quantity: existingQty,
          appliedQuantity: 0,
          reachedMax: true,
        };
      }
      if (idx >= 0) {
        items[idx] = { ...items[idx], quantity: Math.min(99, items[idx].quantity + appliedQuantity) };
      } else {
        items.push({ productId: item.productId, variationId: item.variationId, quantity: appliedQuantity });
      }
      writeRaw(storageKey, items);
      const updatedQty = idx >= 0
        ? items[idx].quantity
        : (items.find((x) => x.productId === item.productId && (x.variationId || '') === (item.variationId || ''))?.quantity || appliedQuantity);
      return {
        ok: appliedQuantity === qty,
        quantity: updatedQty,
        appliedQuantity,
        reachedMax: currentTotal + appliedQuantity >= effectiveMax,
      };
    },

    setQuantity(productId: string, quantity: number, variationId?: string, maxQuantity?: number): CartMutationResult {
      const requestedQty = Math.max(1, Math.min(99, quantity));
      const items = read();
      const effectiveMax =
        Number.isFinite(maxQuantity) && Number(maxQuantity) > 0
          ? Math.max(1, Math.min(99, Number(maxQuantity)))
          : 99;
      const targetItem = items.find(
        (x) => x.productId === productId && (x.variationId || '') === (variationId || ''),
      );
      const otherTotal = items.reduce((sum, item) => {
        if (item.productId !== productId) return sum + 0;
        if ((item.variationId || '') === (variationId || '')) return sum;
        return sum + item.quantity;
      }, 0);
      const qty = Math.max(1, Math.min(requestedQty, Math.max(1, effectiveMax - otherTotal)));
      const nextItems = items.map((x) =>
        x.productId === productId && (x.variationId || '') === (variationId || '') ? { ...x, quantity: qty } : x,
      );
      writeRaw(storageKey, nextItems);
      return {
        ok: qty === requestedQty,
        quantity: qty,
        appliedQuantity: qty - (targetItem?.quantity || 0),
        reachedMax: otherTotal + qty >= effectiveMax,
      };
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
