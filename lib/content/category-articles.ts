/**
 * Long-form editorial articles for category pages, keyed by locale and
 * category slug. Server-side only (see lib/content/tool-articles.ts).
 */

import en from './category-articles.en.json';
import ar from './category-articles.ar.json';

export interface CategoryArticle {
  title: string;
  paragraphs: string[];
}

const ARTICLES: Record<string, Record<string, CategoryArticle>> = {
  en: en as never,
  ar: ar as never,
};

export function getCategoryArticle(slug: string, locale: string): CategoryArticle | undefined {
  const safeLocale = locale === 'ar' ? 'ar' : 'en';
  return ARTICLES[safeLocale][slug] ?? ARTICLES.en[slug];
}
