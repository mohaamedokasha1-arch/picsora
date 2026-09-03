import { getLocale } from 'next-intl/server';
import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site';

export interface SEOInput {
  title?: string;
  description?: string;
  path?: string; // absolute path, e.g. /tools/image-compressor (no locale prefix)
  noIndex?: boolean;
}

export function absoluteUrl(path: string, locale: string): string {
  const base = siteConfig.url.replace(/\/$/, '');
  return `${base}/${locale}${path}`;
}

export function buildMetadata(input: SEOInput, locale: string): Metadata {
  const title = input.title ?? siteConfig.name;
  const description = input.description ?? siteConfig.description;
  const canonical = input.path !== undefined ? absoluteUrl(input.path, locale) : undefined;

  return {
    title,
    description,
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical,
      languages: {
        en: absoluteUrl(input.path ?? '/', 'en'),
        ar: absoluteUrl(input.path ?? '/', 'ar'),
      },
    },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: siteConfig.name,
      type: 'website',
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [siteConfig.ogImage],
    },
    robots: input.noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    icons: {
      icon: '/icons/icon.svg',
      apple: '/icons/apple-touch-icon.png',
    },
    manifest: '/manifest.json',
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
