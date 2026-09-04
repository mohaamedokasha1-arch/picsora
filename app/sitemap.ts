import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site';
import { SLUGS, CATEGORY_SLUGS } from '@/lib/tools/registry';
import { GUIDE_SLUGS } from '@/lib/guides';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;
  const now = new Date();
  const locales = ['en', 'ar'];

  const urls: MetadataRoute.Sitemap = [];

  const add = (path: string, priority: number, changefreq: 'daily' | 'weekly' | 'monthly') => {
    for (const locale of locales) {
      urls.push({
        url: `${base}/${locale}${path}`,
        lastModified: now,
        changeFrequency: changefreq,
        priority,
      });
    }
  };

  // 1. Homepage & Hub pages
  add('/', 1.0, 'daily');
  add('/tools', 0.9, 'daily');
  add('/categories', 0.8, 'weekly');
  add('/guides', 0.8, 'weekly');

  // 2. All Tool Pages
  for (const slug of SLUGS) {
    add(`/tools/${slug}`, 0.9, 'weekly');
  }

  // 3. All Category Pages
  for (const slug of CATEGORY_SLUGS) {
    add(`/categories/${slug}`, 0.8, 'weekly');
  }

  // 4. All Guide Pages
  for (const slug of GUIDE_SLUGS) {
    add(`/guides/${slug}`, 0.8, 'weekly');
  }

  // 5. Informational Pages
  add('/about', 0.4, 'monthly');
  add('/contact', 0.4, 'monthly');

  return urls;
}
