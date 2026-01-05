export interface CartItem {
  productId: string;
  variationId?: string;
  quantity: number;
}

const CART_KEY = 'milko_cart_v1';

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

function read(): CartItem[] {
  if (typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(CART_KEY));
}

function write(items: CartItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export const cartStorage = {
  get(): CartItem[] {
    return read();
  },

  add(item: CartItem) {
    const qty = Math.max(1, Math.min(99, item.quantity));
    const items = read();
    const idx = items.findIndex(
      (x) => x.productId === item.productId && (x.variationId || '') === (item.variationId || '')
    );
    if (idx >= 0) {
      items[idx] = { ...items[idx], quantity: Math.min(99, items[idx].quantity + qty) };
    } else {
      items.push({ productId: item.productId, variationId: item.variationId, quantity: qty });
    }
    write(items);
  },

  setQuantity(productId: string, quantity: number, variationId?: string) {
    const qty = Math.max(1, Math.min(99, quantity));
    const items = read().map((x) =>
      x.productId === productId && (x.variationId || '') === (variationId || '')
        ? { ...x, quantity: qty }
        : x
    );
    write(items);
  },

  remove(productId: string, variationId?: string) {
    const items = read().filter(
      (x) => !(x.productId === productId && (x.variationId || '') === (variationId || ''))
    );
    write(items);
  },

  clear() {
    write([]);
  },
};


