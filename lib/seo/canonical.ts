import { CANONICAL_SITE_URL, localizedPath, siteConfig, siteOrigin } from '@/lib/site';

/**
 * Canonical URL helpers — the single source of truth for the
 * `<link rel="canonical" href="…" />` tag that every page of the site emits
 * inside `<head>`.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Google Search Console flags "Duplicate without user-selected canonical" when
 * it finds two or more URLs serving the same document and no page-level signal
 * telling it which one is the authoritative version. The usual offenders here:
 *
 *   1. Parameterised variants of a page — `/en/tools?sort=asc`,
 *      `/en/tools?filter=pdf`, `/en?ref=monetag`, `?utm_*`… — which crawlers
 *      reach through shared links, ad/tracking links and the Sitelinks
 *      SearchAction (`/en/tools?q={search_term_string}`).
 *   2. A page whose canonical was emitted from a path that still carried a
 *      `?query`/`#fragment`, a double slash, or a trailing slash — i.e. a
 *      canonical that does not match the URL Google actually indexed, so it is
 *      ignored.
 *   3. A route that produced no canonical at all (missing/blank input), which
 *      leaves the duplicate group undecided.
 *
 * The rule this module enforces for every case: a canonical is ALWAYS
 * self-referencing, absolute, locale-prefixed, and free of query parameters
 * and fragments — so all parameter/filter variants of a page funnel their
 * signals into the one clean URL.
 *
 * SAFETY CONTRACT
 * ---------------
 * Nothing in here may ever throw, and nothing may return `undefined`: a
 * missing/blank/malformed path degrades to the locale homepage instead of
 * crashing metadata generation (a throw inside `generateMetadata` would turn a
 * perfectly good page into a 500/white page). Every function is therefore
 * null-checked and wrapped, with `CANONICAL_SITE_URL` as the last-resort origin.
 *
 * This module is side-effect free and depends only on `lib/site`, so it is safe
 * to import from Client Components as well as from `generateMetadata`.
 */

const LOCALES: readonly string[] = siteConfig.locales;
const DEFAULT_LOCALE: string = siteConfig.defaultLocale;

/** Characters that must never survive inside a canonical path. */
// eslint-disable-next-line no-control-regex
const UNSAFE_PATH_CHARS = /[\u0000-\u001F\u007F"'<>\\^`{|}\s]/g;

/** Anything longer than this is not a real page path — treat it as invalid. */
const MAX_PATH_LENGTH = 1024;

/** Query params that may legitimately belong to a canonical (currently none). */
const ALLOWED_PARAMS: readonly string[] = [];

/**
 * Absolute origin used for canonicals.
 *
 * `siteOrigin()` already guards `NEXT_PUBLIC_SITE_URL`, but it is re-checked
 * here so that an unexpected value can never leak into `<head>`: a canonical
 * pointing at a host that does not serve the page is precisely what makes
 * Google give up and pick a canonical itself.
 */
export function canonicalOrigin(): string {
  try {
    const origin = typeof siteOrigin === 'function' ? siteOrigin() : '';
    if (typeof origin === 'string') {
      const trimmed = origin.trim().replace(/\/+$/, '');
      // Production canonicals are always https…
      if (/^https:\/\/[^/\s?#]+$/i.test(trimmed)) return trimmed;
      // …while `lib/site` deliberately allows a localhost origin for local dev
      // (and the sandboxed preview). Honour it so a dev server never writes a
      // canonical for another host into its own <head>.
      if (/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/i.test(trimmed)) return trimmed;
    }
  } catch {
    // Fall through to the verified production origin.
  }
  return CANONICAL_SITE_URL;
}

/** Validate a locale without ever throwing; unknown/missing → default locale. */
export function normalizeCanonicalLocale(locale?: string | null): string {
  try {
    if (typeof locale === 'string' && locale.trim()) {
      const base = locale.trim().toLowerCase().split(/[-_]/)[0];
      if (LOCALES.includes(base)) return base;
    }
  } catch {
    // Ignore and fall back.
  }
  return DEFAULT_LOCALE;
}

/**
 * Turn anything into a clean, parameter-free, absolute-path canonical:
 * `?query` and `#fragment` removed, locale prefix removed (it is re-added by
 * `canonicalUrl`), duplicate slashes collapsed, no trailing slash, and no
 * characters that could break out of the `href` attribute.
 */
export function cleanCanonicalPath(rawPath?: string | null): string {
  try {
    if (typeof rawPath !== 'string') return '/';

    let value = rawPath.trim();
    if (!value) return '/';

    // A full URL may be handed in (e.g. a copied request URL): keep the path
    // only, and drop any foreign origin/protocol so the canonical always points
    // at *this* site.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
      try {
        value = new URL(value).pathname;
      } catch {
        return '/';
      }
    }

    // Protocol-relative (`//host/path`) or scheme-smuggling (`javascript:`)
    // shapes are never valid page paths.
    if (value.startsWith('//')) value = value.replace(/^\/+/, '/');
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '/';

    // 1) Drop the query string and the fragment: ?sort= / ?filter= / ?ref= /
    //    ?utm_* / ?q= must never reach a canonical.
    value = value.split('#')[0].split('?')[0];

    // 2) Remove structural noise and unsafe characters.
    value = value.replace(UNSAFE_PATH_CHARS, '');
    value = value.replace(/\/{2,}/g, '/');
    value = value.replace(/\/+$/, '');

    if (!value || value === '.') return '/';
    if (!value.startsWith('/')) value = `/${value}`;
    if (value.length > MAX_PATH_LENGTH) return '/';

    // 3) Strip any leading locale segment(s) so callers can pass either
    //    `/tools/x` or `/en/tools/x` (even doubled up) and get the same
    //    canonical — `canonicalUrl` re-prefixes with the page's real locale.
    const parts = value.split('/').filter(Boolean);
    while (parts.length > 0 && LOCALES.includes(parts[0])) parts.shift();
    value = parts.length > 0 ? `/${parts.join('/')}` : '/';

    return value === '/' || value === '' ? '/' : value.replace(/\/+$/, '');
  } catch {
    return '/';
  }
}

/**
 * Locale-prefixed, parameter-free canonical *path* (no origin) for a page —
 * e.g. `/en/tools/image-compressor`. This is exactly the shape Next.js
 * resolves `metadataBase` against, and what the client-side guard compares.
 */
export function canonicalPath(path?: string | null, locale?: string | null): string {
  try {
    return localizedPath(cleanCanonicalPath(path), normalizeCanonicalLocale(locale));
  } catch {
    return `/${normalizeCanonicalLocale(locale)}`;
  }
}

/**
 * Absolute self-referencing canonical URL for a page.
 * Never throws and never returns an empty value.
 */
export function canonicalUrl(path?: string | null, locale?: string | null): string {
  try {
    const url = `${canonicalOrigin()}${canonicalPath(path, locale)}`;
    if (url.includes('?') || url.includes('#')) {
      // Defensive: a canonical must not carry parameters even if a helper
      // above ever changes. Strip them here rather than emit a split URL.
      return url.split('#')[0].split('?')[0];
    }
    return url;
  } catch {
    return `${CANONICAL_SITE_URL}/${normalizeCanonicalLocale(locale)}`;
  }
}

/**
 * Every hreflang partner of a page, computed from the same clean path, so the
 * alternate set and the canonical can never disagree (a disagreeing pair is
 * another classic reason for Google ignoring the canonical entirely).
 */
export function canonicalAlternates(path?: string | null): Record<string, string> {
  const clean = cleanCanonicalPath(path);
  const languages: Record<string, string> = {};
  try {
    for (const locale of LOCALES) {
      languages[locale] = canonicalUrl(clean, locale);
    }
    languages['x-default'] = canonicalUrl(clean, DEFAULT_LOCALE);
  } catch {
    // An empty alternate set is better than a broken head.
  }
  return languages;
}

/**
 * Keep only the query parameters that are whitelisted (currently none).
 * Exposed so callers that legitimately need parameters can filter them the
 * same way the canonical does instead of hand-rolling a different rule.
 */
export function filterCanonicalParams(search?: string | null): string {
  try {
    if (typeof search !== 'string' || !search) return '';
    const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
    const kept = new URLSearchParams();
    for (const key of ALLOWED_PARAMS) {
      const value = params.get(key);
      if (value !== null) kept.set(key, value);
    }
    const query = kept.toString();
    return query ? `?${query}` : '';
  } catch {
    return '';
  }
}

/**
 * Strip `?query` / `#fragment` (and trailing/duplicate slashes) from a browser
 * `location.pathname` or an existing `href` value — the browser-side twin of
 * `cleanCanonicalPath`, without the locale round-trip, so the client guard can
 * compare it against the URL the crawler actually has.
 */
export function stripParamsFromHref(href?: string | null): string {
  try {
    if (typeof href !== 'string') return '';
    const bare = href.split('#')[0].split('?')[0].trim();
    if (!bare) return '';

    // An absolute value must be normalised through the URL parser, otherwise
    // the `//` of `https://host` would be mistaken for an empty path segment.
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(bare)) {
      const url = new URL(bare);
      return `${url.origin}${collapsePath(url.pathname)}`;
    }
    return collapsePath(bare);
  } catch {
    return '';
  }
}

/** Remove unsafe characters, collapse duplicate slashes, drop the trailing slash. */
function collapsePath(value: string): string {
  const cleaned = value.replace(UNSAFE_PATH_CHARS, '').replace(/\/{2,}/g, '/');
  const trimmed = cleaned.replace(/\/+$/, '');
  return trimmed || (value.startsWith('/') ? '/' : '');
}
