/**
 * Verification of the canonical layer used by every <head> in the app
 * (`lib/seo/canonical.ts`).
 *
 * Guards the Search Console fix for "Duplicate without user-selected canonical":
 * the canonical must ALWAYS be absolute, self-referencing, locale-prefixed and
 * free of query parameters / fragments — and must NEVER throw, whatever a page
 * hands it (missing, blank or hostile values included).
 *
 * Run with:  npx tsx scripts/tests/canonical.test.ts
 */
import {
  canonicalAlternates,
  canonicalOrigin,
  canonicalPath,
  canonicalUrl,
  cleanCanonicalPath,
  filterCanonicalParams,
  normalizeCanonicalLocale,
  stripParamsFromHref,
} from '../../lib/seo/canonical';
import { buildMetadata, hreflangMap } from '../../lib/seo/metadata';

let fails = 0;
const eq = (name: string, a: unknown, b: unknown) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    fails++;
    console.log('FAIL', name, JSON.stringify(a), '!=', JSON.stringify(b));
  }
};
const ok = (name: string, cond: boolean) => {
  if (!cond) {
    fails++;
    console.log('FAIL', name);
  }
};

const ORIGIN = canonicalOrigin();
ok('origin is https without trailing slash', /^https:\/\/[^/]+$/.test(ORIGIN));

/* ── path cleaning ─────────────────────────────────────────────────────── */
eq('trailing slash stripped', cleanCanonicalPath('/tools/image-compressor/'), '/tools/image-compressor');
eq('query stripped (?sort=)', cleanCanonicalPath('/tools?sort=asc'), '/tools');
eq('query + hash stripped', cleanCanonicalPath('/tools?filter=pdf&page=2#section'), '/tools');
eq('ref/utm stripped', cleanCanonicalPath('/en?ref=monetag&utm_source=newsletter'), '/');
eq('duplicate slashes collapsed', cleanCanonicalPath('//tools//image-resizer//'), '/tools/image-resizer');
eq('leading locale removed', cleanCanonicalPath('/ar/guides/resize-image'), '/guides/resize-image');
eq('both locales removed', cleanCanonicalPath('/en/ar/tools/x'), '/tools/x');
eq('absolute URL reduced to path', cleanCanonicalPath('https://evil.example/en/tools/x?y=1'), '/tools/x');
eq('scheme smuggling rejected', cleanCanonicalPath('javascript:alert(1)'), '/');
eq('space + quotes + control chars removed', cleanCanonicalPath('/tools/my "tool"\n'), '/tools/mytool');

/* ── null / hostile input must degrade, never throw ────────────────────── */
for (const bad of [null, undefined, '', '   ', 0 as unknown as string, {} as unknown as string]) {
  ok(`cleanCanonicalPath(${JSON.stringify(bad) ?? String(bad)}) → '/'`, cleanCanonicalPath(bad) === '/');
  ok(`canonicalUrl(${JSON.stringify(bad) ?? String(bad)}) is absolute`, /^https:\/\//.test(canonicalUrl(bad, 'en')));
}
eq('missing locale → default', normalizeCanonicalLocale(undefined), 'en');
eq('unknown locale → default', normalizeCanonicalLocale('de-DE'), 'en');
eq('fr locale tag → default', normalizeCanonicalLocale('fr'), 'en');
eq('ar locale kept', normalizeCanonicalLocale('ar'), 'ar');
eq('AR upper kept', normalizeCanonicalLocale('AR'), 'ar');

/* ── the canonical itself ──────────────────────────────────────────────── */
eq('canonical is absolute + locale-prefixed', canonicalUrl('/tools/image-compressor', 'en'), `${ORIGIN}/en/tools/image-compressor`);
eq('arabic canonical', canonicalUrl('/tools', 'ar'), `${ORIGIN}/ar/tools`);
eq('root canonical', canonicalUrl('/', 'ar'), `${ORIGIN}/ar`);
eq('params never reach the canonical', canonicalUrl('/tools?sort=asc&ref=x', 'en'), `${ORIGIN}/en/tools`);
eq('locale-prefixed input is accepted', canonicalUrl('/en/tools?x=1', 'en'), `${ORIGIN}/en/tools`);
eq('no throw on weird input', canonicalUrl('///', null), `${ORIGIN}/en`);

/* ── hreflang alternates agree with the canonical ──────────────────────── */
const alt = canonicalAlternates('/tools/image-compressor?ref=abc');
eq('alternate en', alt.en, `${ORIGIN}/en/tools/image-compressor`);
eq('alternate ar', alt.ar, `${ORIGIN}/ar/tools/image-compressor`);
eq('x-default', alt['x-default'], `${ORIGIN}/en/tools/image-compressor`);
eq('hreflangMap shares the cleaner', hreflangMap('/tools/?q=test'), {
  en: `${ORIGIN}/en/tools`,
  ar: `${ORIGIN}/ar/tools`,
  'x-default': `${ORIGIN}/en/tools`,
});

/* ── metadata wiring (head) ───────────────────────────────────────────── */
const md = buildMetadata({ title: 'T', description: 'D', path: '/tools/?sort=asc#top' }, 'en');
eq('alternates.canonical', md.alternates && (md.alternates as { canonical?: string }).canonical, `${ORIGIN}/en/tools`);
ok('canonical has no query', !String(md.alternates && (md.alternates as { canonical?: string }).canonical).includes('?'));
ok('pathless call still emits a canonical', !!buildMetadata({}, 'ar').alternates);
ok(
  'og:url mirrors the clean canonical',
  Boolean(md.openGraph && (md.openGraph as { url?: string }).url === `${ORIGIN}/en/tools`),
);

/* ── helpers used by the head guard ─────────────────────────────────────── */
eq('stripParamsFromHref keeps path', stripParamsFromHref('/en/tools?sort=asc'), '/en/tools');
eq('stripParamsFromHref keeps absolute url', stripParamsFromHref(`${ORIGIN}/en/tools?sort=asc#top`), `${ORIGIN}/en/tools`);
eq('stripParamsFromHref collapses double slashes', stripParamsFromHref('//host//en//tools//'), '/host/en/tools');
eq('stripParamsFromHref root', stripParamsFromHref('/'), '/');
eq('stripParamsFromHref empty-safe', stripParamsFromHref(''), '');
eq('no whitelisted params survive', filterCanonicalParams('?sort=asc&ref=x'), '');

console.log(fails === 0 ? 'OK — canonical tests passed' : `${fails} canonical test(s) failed`);
if (fails > 0) process.exit(1);
