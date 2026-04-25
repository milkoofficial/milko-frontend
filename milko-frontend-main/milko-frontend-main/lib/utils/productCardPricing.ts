import { Product, ProductVariation } from '@/types';

/** First variation by `displayOrder` (then stable order) for card price / discount. */
export function getFirstVariationForCard(p: Product): ProductVariation | null {
  const list = p.variations?.length ? [...p.variations] : [];
  if (list.length === 0) return null;
  list.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  return list[0];
}

export function getProductDisplayUnitLabel(p: Product): string {
  return getFirstVariationForCard(p)?.size || p.suffixAfterPrice || 'litre';
}

function baseUnitPrice(p: Product): number {
  if (p.sellingPrice !== null && p.sellingPrice !== undefined && Number.isFinite(Number(p.sellingPrice))) {
    return Number(p.sellingPrice);
  }
  return Number(p.pricePerLitre);
}

/** Selling price for one variation (explicit `price`, else base × multiplier). */
export function getVariationSellingPrice(v: ProductVariation, p: Product): number {
  if (v.price != null && Number.isFinite(Number(v.price))) return Number(v.price);
  const base = baseUnitPrice(p);
  const mult = Number(v.priceMultiplier) || 1;
  return (Number.isFinite(base) ? base : 0) * mult;
}

/** Price shown on product cards (matches first variation when variations exist). */
export function getCardDisplayPrice(p: Product): number {
  const first = getFirstVariationForCard(p);
  if (first) return getVariationSellingPrice(first, p);
  return (p.sellingPrice !== null && p.sellingPrice !== undefined)
    ? Number(p.sellingPrice)
    : Number(p.pricePerLitre);
}

/** Discount amount for card badge: first variation compare − sell, else product-level compare. */
export function getCardDiscountOff(p: Product): number | null {
  const first = getFirstVariationForCard(p);
  if (first) {
    const selling = getVariationSellingPrice(first, p);
    const cmp = first.compareAtPrice;
    if (cmp === null || cmp === undefined || !Number.isFinite(Number(cmp))) return null;
    const off = Number(cmp) - selling;
    return off > 0 ? off : null;
  }
  const selling = getCardDisplayPrice(p);
  const compare = p.compareAtPrice;
  if (compare === null || compare === undefined) return null;
  if (typeof selling !== 'number' || typeof compare !== 'number') return null;
  const off = compare - selling;
  return off > 0 ? off : null;
}
