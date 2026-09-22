/**
 * Business / "Piclizer for Teams" page content.
 *
 * Same pattern as the legal documents: server-side JSON, one file per locale,
 * rendered only by the business page's server component. The copy is
 * deliberately factual — it lists what the tools actually do, explains how a
 * business inquiry is handled (understand requirements → evaluate → propose
 * the appropriate solution) and states, in a dedicated section, what exists
 * today, so the page never promises an API, bulk processing or "unlimited"
 * capacity that has not been built.
 */

import en from './business.en.json';
import ar from './business.ar.json';

export interface BusinessSection {
  h: string;
  ps: string[];
  bullets?: string[];
}

export interface BusinessDoc {
  title: string;
  intro: string;
  sections: BusinessSection[];
  ctaHeading: string;
  ctaText: string;
  ctaLabel: string;
  faqs: { q: string; a: string }[];
}

const DOCS: Record<string, BusinessDoc> = {
  en: en as BusinessDoc,
  ar: ar as BusinessDoc,
};

export function getBusinessDoc(locale: string): BusinessDoc {
  const safeLocale = locale === 'ar' ? 'ar' : 'en';
  return DOCS[safeLocale] ?? DOCS.en;
}
