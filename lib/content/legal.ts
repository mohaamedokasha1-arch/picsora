/**
 * Long-form legal & editorial content.
 *
 * These texts are intentionally large, so they live here as server-side JSON
 * modules instead of next-intl messages — the messages bundle is shipped to
 * the client on every page, while this content is only needed by server
 * components that render the legal pages and the deep-dive article sections.
 */

export interface LegalSection {
  h?: string;
  ps: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  intro?: string;
  sections: LegalSection[];
}

export type LegalKind = 'about' | 'privacy' | 'terms' | 'cookiePolicy' | 'disclaimer';

import en from './legal.en.json';
import ar from './legal.ar.json';

const DOCS: Record<string, Record<LegalKind, LegalDoc>> = {
  en: en as never,
  ar: ar as never,
};

export function getLegalDoc(kind: LegalKind, locale: string): LegalDoc {
  const safeLocale = locale === 'ar' ? 'ar' : 'en';
  return DOCS[safeLocale][kind] ?? DOCS.en[kind];
}

export const LEGAL_KINDS: LegalKind[] = ['about', 'privacy', 'terms', 'cookiePolicy', 'disclaimer'];
