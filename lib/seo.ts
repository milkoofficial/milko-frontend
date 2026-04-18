export const SITE_NAME = 'Milko.in';
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://milko.in').trim();
export const SITE_DESCRIPTION =
  'Fresh milk delivery, dairy products, and subscription plans delivered to your doorstep by Milko.in.';

export const DEFAULT_KEYWORDS = [
  'milk delivery',
  'fresh milk delivery',
  'daily milk subscription',
  'dairy delivery',
  'Milko',
  'Milko.in',
];

export const PUBLIC_SITEMAP_ROUTES = [
  '/',
  '/products',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
] as const;

export function getSiteUrl(): URL {
  try {
    return new URL(SITE_URL);
  } catch {
    return new URL('https://milko.in');
  }
}

export function absoluteUrl(pathname = '/'): string {
  return new URL(pathname, getSiteUrl()).toString();
}
