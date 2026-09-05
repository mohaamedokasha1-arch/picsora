/**
 * Canonical production origin — verified 2026-09-05:
 * `https://piclizer.vercel.app` resolves and serves the live site, while
 * `piclizer.app` has no DNS records at all (NXDOMAIN). Every absolute URL the
 * app emits (sitemap.xml, robots.txt, canonical, hreflang, Open Graph,
 * Twitter cards, JSON-LD) derives from this value, so the sitemap always
 * matches the real site domain exactly.
 *
 * To move to a custom domain later: point its DNS at the deployment, verify
 * it resolves, add the new origin to VERIFIED_SITE_ORIGINS below, then set
 * NEXT_PUBLIC_SITE_URL to it.
 */
export const CANONICAL_SITE_URL = 'https://piclizer.vercel.app';

/**
 * Origins this deployment is allowed to present as canonical. A
 * NEXT_PUBLIC_SITE_URL from the environment is honoured ONLY if it
 * normalises to one of these — anything else is ignored (with a build
 * warning) so a stale or mistyped dashboard value can never poison
 * sitemap.xml, canonical tags or robots.txt again.
 *
 * When a custom domain is connected and its DNS verified, add it here.
 */
const VERIFIED_SITE_ORIGINS: readonly string[] = [CANONICAL_SITE_URL];

/** Normalise a raw value to a bare origin, or null if it is not one. */
function normaliseOrigin(raw: string): string | null {
  const cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return null;
  try {
    const parsed = new URL(cleaned);
    const bare = parsed.pathname === '/' && !parsed.search && !parsed.hash;
    const noAuth = !parsed.username && !parsed.password;
    const isHttps = parsed.protocol === 'https:' && !parsed.port;
    const isLocalhost =
      parsed.hostname === 'localhost' && (parsed.protocol === 'http:' || parsed.protocol === 'https:');
    if (bare && noAuth && (isHttps || isLocalhost)) return parsed.origin;
  } catch {
    // Not a valid URL.
  }
  return null;
}

function isLocalhostOrigin(origin: string): boolean {
  return origin === 'http://localhost' || origin === 'https://localhost' ||
    origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:');
}

/**
 * Resolve the site origin. The verified canonical domain is the default;
 * the environment can only select a localhost origin (local dev) or another
 * verified production origin — never an arbitrary/wrong domain.
 */
function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  if (!raw.trim()) return CANONICAL_SITE_URL;
  const origin = normaliseOrigin(raw);
  if (origin && (isLocalhostOrigin(origin) || VERIFIED_SITE_ORIGINS.includes(origin))) {
    return origin;
  }
  console.warn(
    `[site] Ignoring NEXT_PUBLIC_SITE_URL=${JSON.stringify(raw)} — not a verified production ` +
      `origin. Using canonical ${CANONICAL_SITE_URL} so sitemap/canonical URLs always match the real site.`,
  );
  return CANONICAL_SITE_URL;
}

export const siteConfig = {
  name: 'Piclizer',
  url: resolveSiteUrl(),
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
