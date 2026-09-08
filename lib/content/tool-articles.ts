/**
 * Long-form editorial articles for every tool, keyed by locale then slug.
 * Lives server-side (not in next-intl messages) so the text is rendered by
 * server components only and never shipped to the client bundle.
 */

import type { ToolDeepDive } from './types';

import image1En from './articles/image-1.en.json';
import image1Ar from './articles/image-1.ar.json';
import image2En from './articles/image-2.en.json';
import image2Ar from './articles/image-2.ar.json';
import pdfEn from './articles/pdf.en.json';
import pdfAr from './articles/pdf.ar.json';
import textEn from './articles/text.en.json';
import textAr from './articles/text.ar.json';
import calcEn from './articles/calc.en.json';
import calcAr from './articles/calc.ar.json';
import devEn from './articles/dev.en.json';
import devAr from './articles/dev.ar.json';

type ArticleFile = Record<string, ToolDeepDive>;

function merge(...files: ArticleFile[]): ArticleFile {
  return Object.assign({}, ...files) as ArticleFile;
}

const ARTICLES: Record<string, ArticleFile> = {
  en: merge(
    image1En as ArticleFile,
    image2En as ArticleFile,
    pdfEn as ArticleFile,
    textEn as ArticleFile,
    calcEn as ArticleFile,
    devEn as ArticleFile,
  ),
  ar: merge(
    image1Ar as ArticleFile,
    image2Ar as ArticleFile,
    pdfAr as ArticleFile,
    textAr as ArticleFile,
    calcAr as ArticleFile,
    devAr as ArticleFile,
  ),
};

export function getToolArticle(slug: string, locale: string): ToolDeepDive | undefined {
  const safeLocale = locale === 'ar' ? 'ar' : 'en';
  return ARTICLES[safeLocale][slug] ?? ARTICLES.en[slug];
}

export function hasToolArticle(slug: string, locale: string): boolean {
  return Boolean(getToolArticle(slug, locale));
}
