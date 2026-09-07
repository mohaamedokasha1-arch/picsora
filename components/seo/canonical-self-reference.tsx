'use client';

import { useEffect } from 'react';
import { stripParamsFromHref } from '@/lib/seo/canonical';

/**
 * Canonical safety net — `<head>` only.
 *
 * Every page already renders a correct self-referencing `<link rel="canonical">`
 * from `generateMetadata` (see `lib/seo/metadata.ts` + `lib/seo/canonical.ts`),
 * so in the normal case this component changes nothing at all and is a no-op.
 *
 * It exists for the cases that produced the Search Console
 * "Duplicate without user-selected canonical" report:
 *
 *  - A URL variant that reaches a document whose canonical still carries
 *    parameters (`?sort=`, `?filter=`, `?ref=`, `?utm_*`, a trailing slash, a
 *    duplicated slash…). Those get rewritten to the clean, self-referencing
 *    address so all variants consolidate onto one canonical URL.
 *  - A document that somehow has no canonical at all: a self-referencing one is
 *    added, so Google is never left without an explicit signal.
 *
 * Rules it obeys, deliberately:
 *  - It never rewrites a canonical that points at a *different* page (a
 *    deliberate canonical is respected, not "fixed").
 *  - It never adds a canonical to a `noindex` document (that combination is
 *    contradictory and gets the tag ignored site-wide).
 *  - It is idempotent (own additions are marked and de-duplicated) and every
 *    step is guarded, so a missing `document`/`location`/URL can never throw
 *    and blank the page.
 */
const SELF_MARKER = 'data-canonical-self';

export function CanonicalSelfReference() {
  useEffect(() => {
    try {
      const doc = typeof document !== 'undefined' ? document : null;
      const loc = typeof window !== 'undefined' && window ? window.location : null;
      if (!doc || !doc.head || !loc) return;

      const protocol = typeof loc.protocol === 'string' ? loc.protocol : '';
      const origin = typeof loc.origin === 'string' && loc.origin ? loc.origin : '';
      const cleanPathname = stripParamsFromHref(loc.pathname || '/');
      // Only ever build a canonical from a real http(s) origin + path.
      if (!/^https?:$/i.test(protocol) || !origin || !cleanPathname) return;

      const self = `${origin}${cleanPathname}`;

      // noindex documents must not receive a canonical.
      const robotsMeta = doc.head.querySelector('meta[name="robots"]');
      const robots = robotsMeta ? robotsMeta.getAttribute('content') ?? '' : '';
      if (/noindex/i.test(robots)) {
        doc.head.querySelectorAll(`link[rel="canonical"][${SELF_MARKER}]`).forEach((node) => node.remove());
        return;
      }

      const existing = Array.from(doc.head.querySelectorAll('link[rel="canonical"]'));

      if (existing.length === 0) {
        const link = doc.createElement('link');
        link.setAttribute('rel', 'canonical');
        link.setAttribute('href', self);
        link.setAttribute(SELF_MARKER, 'true');
        doc.head.appendChild(link);
        return;
      }

      const primary = existing[0];
      const current = primary.getAttribute('href') ?? '';

      // Normalise only a canonical that already refers to this very page but is
      // polluted by query parameters / fragments / slash noise.
      if (current) {
        const cleaned = stripParamsFromHref(current);
        if (cleaned && cleaned !== current && (cleaned === self || `${origin}${cleaned}` === self)) {
          primary.setAttribute('href', self);
        }
      } else {
        primary.setAttribute('href', self);
        primary.setAttribute(SELF_MARKER, 'true');
      }

      // A second canonical would split the signal: drop only the ones we added
      // ourselves or the ones carrying parameters.
      for (const duplicate of existing.slice(1)) {
        const href = duplicate.getAttribute('href') ?? '';
        if (duplicate.hasAttribute(SELF_MARKER) || /[?#]/.test(href)) {
          duplicate.remove();
        }
      }
    } catch {
      // A missing or unreadable URL must never take the page down.
    }
  }, []);

  return null;
}

export default CanonicalSelfReference;
