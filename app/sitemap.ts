import type { MetadataRoute } from 'next';
import { siteConfig, absoluteUrl } from '@/lib/site';
import { SLUGS, CATEGORY_SLUGS } from '@/lib/tools/registry';
import { GUIDE_SLUGS } from '@/lib/guides';

type Changefreq = 'daily' | 'weekly' | 'monthly';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date(siteConfig.contentUpdatedAt);
  const locales = [...siteConfig.locales];

  const urls: MetadataRoute.Sitemap = [];

  const alternates = (path: string) => ({
    languages: {
      ...Object.fromEntries(locales.map((locale) => [locale, absoluteUrl(path, locale)])),
      'x-default': absoluteUrl(path, siteConfig.defaultLocale),
    },
  });

  const add = (path: string, priority: number, changefreq: Changefreq) => {
    for (const locale of locales) {
      urls.push({
        url: absoluteUrl(path, locale),
        lastModified: now,
        changeFrequency: changefreq,
        priority,
        alternates: alternates(path),
      });
    }
  };

  add('/', 1, 'daily');
  add('/tools', 0.9, 'weekly');
  add('/categories', 0.8, 'weekly');
  add('/guides', 0.85, 'weekly');

  for (const slug of SLUGS) add(`/tools/${slug}`, 0.8, 'weekly');
  for (const slug of CATEGORY_SLUGS) add(`/categories/${slug}`, 0.7, 'weekly');
  for (const slug of GUIDE_SLUGS) add(`/guides/${slug}`, 0.85, 'monthly');

  /*
   * Thin / low-value pages are intentionally excluded from the sitemap.
   *
   * Privacy policy, cookie policy, terms of service, disclaimer, about and
   * contact pages carry no unique search value and Google consistently marks
   * them "Crawled – currently not indexed". Listing them wastes crawl budget
   * and inflates the "Discovered – currently not indexed" count in GSC.
   *
   * They remain accessible and linked from the site footer; they simply are
   * no longer *promoted* to Google via the sitemap. A `noindex` robots meta
   * tag on each page (set via `buildMetadata({ noIndex: true })`) tells
   * Google explicitly not to index them, which removes them from the
   * "Crawled – currently not indexed" bucket.
   */

  return urls;
}
