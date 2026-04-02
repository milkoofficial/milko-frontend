import { apiClient } from './client';

export type CartAnalyticsEventType = 'add' | 'remove' | 'clear' | 'order_placed';

const CART_SESSION_KEY = 'milko_cart_session_id_v1';

function getOrCreateCartSessionId(): string {
  if (typeof window === 'undefined') return 'server';

  const existing = window.localStorage.getItem(CART_SESSION_KEY);
  if (existing && typeof existing === 'string') return existing;

  const id =
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`);
  window.localStorage.setItem(CART_SESSION_KEY, id);
  return id;
}

export async function trackCartEvent(input: {
  eventType: CartAnalyticsEventType;
  cartItemCount: number;
  productId?: string;
  variationId?: string;
}) {
  try {
    const sessionId = getOrCreateCartSessionId();
    await apiClient.post('/analytics/cart-event', {
      sessionId,
      eventType: input.eventType,
      productId: input.productId ?? null,
      variationId: input.variationId ?? null,
      cartItemCount: Number.isFinite(input.cartItemCount) ? input.cartItemCount : 0,
    });
  } catch {
    // analytics must never block UX
  }
}

export function getCartSessionIdForDebug(): string {
  return getOrCreateCartSessionId();
}
