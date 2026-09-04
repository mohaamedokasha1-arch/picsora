import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';
import { SLUGS, CATEGORY_SLUGS } from '@/lib/tools/registry';
import { GUIDE_SLUGS } from '@/lib/guides';

type Changefreq = 'daily' | 'weekly' | 'monthly';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url.replace(/\/$/, '');
  const now = new Date();
  const locales = [...siteConfig.locales];

  const urls: MetadataRoute.Sitemap = [];

  const alternates = (path: string) => ({
    languages: Object.fromEntries(locales.map((locale) => [locale, `${base}/${locale}${path}`])),
  });

  const add = (path: string, priority: number, changefreq: Changefreq) => {
    for (const locale of locales) {
      urls.push({
        url: `${base}/${locale}${path}`,
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

  add('/about', 0.4, 'monthly');
  add('/contact', 0.4, 'monthly');
  add('/privacy-policy', 0.3, 'monthly');
  add('/cookie-policy', 0.3, 'monthly');
  add('/terms-of-service', 0.3, 'monthly');
  add('/disclaimer', 0.3, 'monthly');

  return urls;
}
