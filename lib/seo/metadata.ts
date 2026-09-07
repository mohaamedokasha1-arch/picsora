import { getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { absoluteUrl, siteConfig, siteOrigin } from '@/lib/site';
import { canonicalAlternates, canonicalOrigin, canonicalUrl } from '@/lib/seo/canonical';

export interface SEOInput {
  title?: string;
  description?: string;
  path?: string; // absolute path, e.g. /tools/image-compressor (no locale prefix)
  noIndex?: boolean;
  keywords?: string[];
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
}

const INDEXING_ROBOTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    'max-image-preview': 'large' as const,
    'max-snippet': -1,
    'max-video-preview': -1,
  },
};

const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
};

export { absoluteUrl };

/**
 * hreflang partners of a page.
 *
 * Delegates to the canonical layer so every alternate is built from the same
 * clean, parameter-free path as `<link rel="canonical">`: canonical and hreflang
 * pointing at different URLs is one of the classic reasons Google ignores both
 * and reports "Duplicate without user-selected canonical".
 */
export function hreflangMap(path: string): Record<string, string> {
  return canonicalAlternates(path);
}

export function buildMetadata(input: SEOInput, locale: string): Metadata {
  const title = input.title ?? siteConfig.name;
  const description = input.description ?? siteConfig.description;
  const path = input.path ?? '/';
  /**
   * Self-referencing canonical for this page: absolute, locale-prefixed, and
   * stripped of `?query` / `#fragment` (no ?sort=, ?filter=, ?ref=, ?utm_*),
   * so every parameterised variant of the URL funnels its signals into the one
   * clean address Google should index.
   *
   * Wrapped defensively on top of the helpers' own null-checks: if a page ever
   * calls us without a usable `path` (or anything here throws), <head> still
   * gets a valid canonical for the locale homepage instead of a crashed render.
   */
  let canonical: string;
  let languages: Record<string, string>;
  try {
    canonical = canonicalUrl(path, locale);
    languages = hreflangMap(path);
  } catch {
    canonical = canonicalOrigin();
    languages = {};
  }
  const ogLocale = locale === 'ar' ? 'ar_EG' : 'en_US';
  const ogType = input.type ?? 'website';
  const ogImage = {
    url: siteConfig.ogImage,
    width: 1200,
    height: 630,
    alt: title,
    type: 'image/jpeg' as const,
  };
  const keywords = Array.from(new Set([...(input.keywords ?? []), ...siteConfig.keywords]));
  const openGraphBase = {
    title,
    description,
    url: canonical,
    siteName: siteConfig.name,
    locale: ogLocale,
    alternateLocale: locale === 'ar' ? (['en_US'] as string[]) : (['ar_EG'] as string[]),
    images: [ogImage],
  };
  const openGraph =
    ogType === 'article'
      ? {
          ...openGraphBase,
          type: 'article' as const,
          publishedTime: input.publishedTime ?? siteConfig.contentUpdatedAt,
          modifiedTime: input.modifiedTime ?? siteConfig.contentUpdatedAt,
          authors: input.authors ?? [siteConfig.name],
        }
      : { ...openGraphBase, type: 'website' as const };

  return {
    title,
    description,
    keywords,
    authors: [{ name: siteConfig.name, url: siteOrigin() }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    category: 'utilities',
    metadataBase: new URL(siteOrigin()),
    applicationName: siteConfig.name,
    referrer: 'origin-when-cross-origin',
    formatDetection: { telephone: false, email: false, address: false },
    alternates: {
      canonical,
      languages,
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [siteConfig.ogImage],
    },
    robots: input.noIndex ? NOINDEX_ROBOTS : INDEXING_ROBOTS,
  };
}

export async function buildMetadataForLocale(input: SEOInput): Promise<Metadata> {
  const locale = await getLocale();
  return buildMetadata(input, locale);
}

/** Resolve the request locale safely (used by root layout). */
export async function getResolvedLocale(): Promise<'en' | 'ar'> {
  const locale = await getLocale();
  return locale === 'ar' ? 'ar' : 'en';
}
