export const siteConfig = {
  name: 'Piclizer',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://piclizer.vercel.app',
  /** Raster OG image — social crawlers do not reliably fetch SVG. */
  ogImage: '/images/og-image.jpg',
  description:
    'Free online tools that run 100% in your browser. Compress images, convert iPhone HEIC photos, edit PDFs, extract text and format code — privately.',
  keywords: [
    'image tools',
    'image compressor',
    'image resizer',
    'image converter',
    'heic to jpg',
    'compress image to exact kb',
    'pdf tools',
    'pdf to text',
    'ocr online',
    'developer tools',
    'jpg to png',
    'online image editor',
    'free image tools',
  ],
  defaultLocale: 'en',
  locales: ['en', 'ar'] as const,
  contactEmail: 'privacy@piclizer.app',
  adsensePublisherId: 'ca-pub-5770911159315916',
  /** Used for Article datePublished / sitemap lastmod when a page has no own date. */
  contentUpdatedAt: '2026-09-04',
};

export type Locale = (typeof siteConfig.locales)[number];

export function siteOrigin(): string {
  return siteConfig.url.replace(/\/$/, '');
}

/** Locale-prefixed path without a trailing slash (`/` → `/en`). */
export function localizedPath(path: string, locale: string): string {
  const normalized = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

/** Absolute URL for a locale + path, never trailing-slash except the origin itself. */
export function absoluteUrl(path: string, locale: string): string {
  return `${siteOrigin()}${localizedPath(path, locale)}`;
}

export function absoluteAsset(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`;
}
