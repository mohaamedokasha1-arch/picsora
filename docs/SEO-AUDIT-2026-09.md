# Piclizer — Technical SEO Audit & Remediation

**Date:** 2026-09-14 · **Scope:** https://piclizer.vercel.app · **Branch:** `arena/01a0a0a9-picsora`

Audit-first engagement: inspect everything, change only what is broken, missing or
inaccurate. No redesign, no rebranding, no new tools, no URL-structure change, no
change to how any tool processes files.

---

## 1. Headline numbers

| | Count |
|---|---|
| Issues found | 14 |
| Issues fixed | 14 |
| Things checked and deliberately left alone | 21 |
| Items requiring manual action in Search Console | 4 |
| Pages improved | 240 rendered pages (95 tools × 2 locales + categories, indexes, guides) |
| Tools audited | 95 (all) |

Verification after every change: `npm run build` clean, all **85 project tests** pass,
247-URL crawl returns **100% HTTP 200**, 0 duplicate titles, 0 duplicate descriptions,
0 canonical mismatches, 0 invalid JSON-LD blocks.

---

## 2. Site inventory (Phase 1)

Discovered by crawling the rendered site from `/en` and `/ar`, not by reading config:

| Type | Count (per locale) | Pattern |
|---|---|---|
| Home | 1 | `/{locale}` |
| Tools index | 1 | `/{locale}/tools` |
| Tool pages | 95 | `/{locale}/tools/{slug}` |
| Categories index | 1 | `/{locale}/categories` |
| Category pages | 9 | `/{locale}/categories/{slug}` |
| Guides index | 1 | `/{locale}/guides` |
| Guide pages | 6 | `/{locale}/guides/{slug}` |
| Legal/utility | 6 | about, contact, privacy-policy, terms-of-service, cookie-policy, disclaimer |

**Category breakdown (95 tools):** compress 2 · resize 1 · convert 9 · edit 17 ·
color 2 · pdf-tools 21 · text-tools 13 · calculator-tools 10 · developer-tools 20.

All 95 tools are reachable from plain crawlable `<a href>` markup in the
server-rendered HTML (verified: 95 unique tool links present in the raw HTML of both
`/en` and `/en/tools`). Nothing is hidden behind a JavaScript-only interaction.

---

## 3. Issues found and fixed

### P0 — Every un-prefixed URL collapsed to the homepage

**The most damaging issue on the site, and it was live in production.**

`middleware.ts` guarded against open redirects by rejecting any `Location` header
matching `^\s*(\/\/|[a-z][a-z0-9+.-]*:)`. That regex also matches a perfectly safe
**absolute same-origin** URL — `https://piclizer.vercel.app/en/tools/heic-to-jpg`
starts with the `https:` scheme — and that is exactly the shape `next-intl` emits.

Consequence: every URL without a locale prefix was 307'd to the bare `/en` homepage
instead of its real destination.

```
BEFORE  /tools/image-compressor  → 307 → /en          (destination lost)
AFTER   /tools/image-compressor  → 307 → /en/tools/image-compressor
```

Confirmed against production before the fix: `https://piclizer.vercel.app/tools/image-compressor`
served the homepage. Any backlink, shared link, or typed URL without `/en/` lost its
target; Google sees a redirect to irrelevant content, which is treated as a soft 404
and passes no signal to the page that earned the link.

**Fix:** the guard now compares the *resolved origin* — which is what actually matters
for an open redirect — and only treats protocol-relative URLs (`//host`, `/\host`) as
hostile. Foreign schemes and hosts are still refused.

Security regression-tested, all still correct: `//evil.com` → same-origin path (Next
normalises it before middleware), `https://evil.com/x` → refused, `javascript:` →
refused, `/wp-admin` `/.env` `/x.php` → 404, `POST` → 405, all 5 security headers
still present on every response.

> Note: `Location` is kept absolute. A relative value throws `ERR_INVALID_URL` in the
> Edge runtime — caught during verification, when the first attempt produced HTTP 500s.

### P1 — Privacy claims that were not true

The site's core promise is local processing, which makes an inaccurate privacy claim a
trust and compliance problem, not just an SEO one.

1. **Category FAQ** stated *"Every tool in this category processes your **images**
   entirely in your browser"* — rendered verbatim on PDF Tools, Text Tools,
   Calculators and Developer Tools, which do not process images at all. Now written
   per category, in both languages.
2. **Tool deep-dive note** claimed *"Like every Piclizer tool, this one runs entirely
   in your browser"* on all 95 pages. Untrue for three:
   - `image-ocr`, `pdf-ocr` — download the Tesseract engine + language data from a CDN
   - `currency-converter` — fetches a public exchange-rate table

   These three now state precisely what touches the network. The user's files and
   amounts still never leave the device, and that distinction is now stated explicitly
   rather than glossed over.

### P1 — 18 tool pages had no long-form content

`image-blur`, `image-pixelate`, `brightness-contrast`, `image-filters`,
`rounded-corners`, `image-metadata`, `pdf-page-numbers`, `pdf-watermark`,
`pdf-grayscale`, `pdf-metadata-editor`, `pdf-extract-images`, `line-sorter`,
`text-extractor`, `text-frequency-counter`, `json-csv-converter`, `url-parser`,
`timestamp-converter`, `cron-generator`.

These rendered the tool UI, How-to, formats and FAQ but no deep-dive section — thin
next to the 77 tools that had one. Each now has a unique EN + AR article written
against the tool's real behaviour, covering the trade-off a user actually needs
(why pixelation beats blur for redaction; why a millisecond timestamp parsed as
seconds lands 50,000 years out; why JPG corners come out white; why PDF-to-grayscale
makes text unselectable). **All 95 tools now have deep-dive content in both locales.**

### P1 — Arabic titles were half English

Tool pages hard-coded an English suffix, so every Arabic tool page rendered a
mixed-language title in the Arabic SERP:

```
BEFORE  ضاغط الصور — Free Online Tool | Piclizer
AFTER   ضاغط الصور — أداة مجانية أونلاين | Piclizer
```

### P2 — Category titles carried no search signal

`PDF Tools — Piclizer` → `PDF Tools — Free Online Tools | Piclizer` (suffix
translated for `/ar`). Category pages also now emit their tool names as keywords.

### P2 — Breadcrumb skipped the category

`Home → Tools → PDF Merger` gave tool pages no crawlable link up to their section, and
the `BreadcrumbList` never expressed the grouping. Now
`Home → Tools → PDF Tools → PDF Merger` — matching the hierarchy requested, and adding
95 × 2 new tool→category internal links.

### P2 — Related tools were not the real workflow

Several tools appear in multiple `RELATED_PATCH` lists, each of which *prepends*. The
genuine next steps were pushed past the four slots the UI renders — someone who had
just converted an iPhone photo was offered *HEIC to PNG* (the same conversion again).

```
BEFORE  heic-to-jpg → heic-to-png, jpg-to-png, image-compressor, image-to-exact-kb
AFTER   heic-to-jpg → image-compressor, image-resizer, image-to-pdf, heic-to-png
BEFORE  pdf-to-word → pdf-to-text, pdf-ocr, pdf-merger, text-to-slug
AFTER   pdf-to-word → pdf-ocr, pdf-compressor, pdf-merger, pdf-to-text
```

A final ordering pass pins the real workflow neighbours for the 16 highest-intent
tools. **Reordering only — no link removed.** Still 0 orphans, 0 dead references,
0 self-references.

### P2 — `SearchAction` promised a search entry point that did nothing

`WebSite` schema advertised `/tools?q={search_term_string}`, but nothing read `q`.
`/tools` now seeds the search box from the URL (client-side only, so the static HTML
and canonical are unchanged).

### P2 — Missing head terms in the registry keywords

`compress image`, `crop image` and `pdf compressor` had no keyword entry, so they were
absent from page metadata *and* unreachable via on-site search. Added with their
Arabic equivalents (`ضغط الصور`, `تقليل حجم الصورة`, `قص الصور`, `تحويل pdf إلى صور`).

### P3 — Over-length metadata

Two titles >65 chars and three descriptions >165 chars were truncating in results.
Trimmed. Now **0 titles >65 and 0 descriptions >165 across all 240 pages.**

### P3 — Stale `lastmod`

`contentUpdatedAt` refreshed to `2026-09-14` so sitemap `lastmod` reflects this work.

---

## 4. Checked and deliberately left unchanged

Per the brief — if it is correct, keep it. All of the following were verified working
and **not touched**:

- **robots.txt** — correct. Allows everything, disallows only `/api/`, declares host +
  sitemap. Does not block CSS, JS, images or any tool page.
- **sitemap.xml** — 228 URLs, all absolute HTTPS, all unique, all 200, all indexable,
  all self-canonical, zero redirects, zero noindex entries. Correctly *excludes* the
  six thin legal pages.
- **Canonicals** — self-referencing on all 240 pages; query strings correctly stripped
  (`/en/tools?q=x` → canonical `/en/tools`).
- **hreflang** — complete reciprocal `en` / `ar` / `x-default` on every page.
- **`noindex` on legal pages** — intentional and correct; they stay crawlable and
  footer-linked.
- **Root `/` noindex + canonical to `/en`** — correct handling of the un-prefixed root.
- **Locale-less root redirect, `pdf` → `pdf-tools` 301, trailing-slash 308** — all
  correct, no chains or loops.
- **H1s** — exactly one per page across all 240; none missing, none duplicated.
- **Title/description uniqueness** — already 0 duplicates before and after.
- **Structured data** — `WebSite`, `Organization`, `WebApplication`, `HowTo`,
  `FAQPage`, `BreadcrumbList`, `ItemList`, `CollectionPage`, `Article` all valid, all
  free of fake ratings/reviews. Left in place.
- **JS/SSR rendering** — titles, descriptions, H1s, tool copy and all links are present
  in the raw server HTML; nothing depends on client-side rendering to be understood.
- **Mobile** — buttons already grow to `h-9` on phones and shrink at `sm:`; wide tables
  already sit in `overflow-x-auto`; no fixed widths that force horizontal scroll.
  No real defect found, so no change made.
- **Performance** — homepage 104 KB gzipped, tool page 80 KB, shared JS 89 KB, ad slots
  already reserve height (`minHeight`) to avoid CLS, fonts are system-stack (no webfont
  round-trip). Healthy; no speculative changes made.
- **404 handling** — `/en/tools/does-not-exist` correctly returns a real 404.
- **OG image** — verified 1200×630, correct dimensions declared.
- **Tool descriptions/intros/FAQs** — already unique per tool across all 95; not
  rewritten.
- **Design, branding, logo, colours, URL structure, tool behaviour, local processing**
  — untouched.

---

## 5. Things I refused to do, and why

- **Did not remove `FAQPage` / `HowTo` schema.** Google stopped showing FAQ rich
  results on 2026-05-07 and deprecated HowTo in 2023, but it explicitly still uses the
  markup to understand pages and states that unused structured data causes no problems.
  The FAQs here are genuine on-page content, not markup-only filler, so removal would
  be churn with a small downside.
- **Did not remove the `SearchAction`.** The sitelinks searchbox was retired in
  Nov 2024, but the markup is harmless, still parsed as an entity signal, and now
  actually functional. Fixing it was cheaper and more honest than deleting it.
- **Did not add `Product`, `Review` or `AggregateRating` schema.** There are no real
  ratings. Inventing them violates Google's guidelines.
- **Did not create per-keyword landing pages** (e.g. a separate page for "compress
  jpg" vs "compress png"). That is doorway-page territory; those terms are covered
  naturally on the existing tool page.
- **Did not restructure URLs.** The current structure is clean and indexed; churn would
  cost more than it gains.
- **Did not add new tools or redesign anything.** Explicitly out of scope.
- **Did not chase a perfect Lighthouse score.** No real bottleneck was found, and
  speculative refactoring risks breaking working tools.

---

## 6. Manual Google Search Console actions

These cannot be done from code:

1. **Resubmit `sitemap.xml`.** `lastmod` changed on all 228 URLs; resubmitting prompts
   a recrawl.
2. **Use "Validate Fix" on soft-404 / redirect reports.** The P0 middleware bug will
   have generated *"Page with redirect"* and soft-404 entries for un-prefixed URLs.
   Once deployed, validate so Google reprocesses them.
3. **Request indexing for the highest-value pages** — image-compressor, heic-to-jpg,
   pdf-to-word, pdf-compressor, image-resizer, image-cropper, merge-pdf, pdf-ocr — in
   both locales, to speed up re-evaluation of the corrected titles and content.
4. **Confirm the `ar` property is reporting.** Check International Targeting for
   hreflang errors after the recrawl. The markup is correct; only Google can confirm
   it is being consumed.

A verification meta tag is already present in `app/[locale]/layout.tsx`, so the
property is verified.

---

## 7. Top 10 improvements delivered

1. Fixed the P0 middleware bug sending every un-prefixed URL to the homepage.
2. Corrected false "your images" privacy claims on 4 non-image categories.
3. Corrected the overstated offline claim on the 2 OCR tools + currency converter.
4. Added unique EN + AR long-form content to 18 previously thin tool pages.
5. Fixed mixed-language Arabic titles on all 95 Arabic tool pages.
6. Added the category hop to breadcrumbs (190 new tool→category internal links).
7. Reordered related tools to follow real user workflows on 16 high-intent tools.
8. Gave category pages a search-relevant, translated title qualifier.
9. Made `/tools?q=` work, honouring the `SearchAction` the schema advertises.
10. Added missing head keywords (EN + AR) and trimmed all over-length metadata.

## 8. Top 10 remaining opportunities (not done — needs your input or is off-code)

1. **Custom domain.** `piclizer.vercel.app` is a subdomain of a shared host; a branded
   domain is the single biggest long-term authority lever. Code is already prepared —
   add the origin to `VERIFIED_SITE_ORIGINS` in `lib/site.ts`.
2. **More guides.** Only 6 exist. Highest-intent gaps matching your tools:
   *reduce PDF size*, *PDF to Word*, *images to PDF*, *extract text from PDF (OCR)*,
   *compress to an exact KB*. Quality over volume.
3. **Guide → tool coverage.** All 6 guides are image-focused; PDF tools (your largest
   category, 21 tools) have no guide traffic feeding them.
4. **Per-tool OG images.** All pages share one generic image; per-tool cards improve
   social CTR.
5. **Real `dateModified` per tool/guide.** Currently one site-wide constant; per-page
   dates are a stronger freshness signal.
6. **Category descriptions are thin** for `color`, `convert`, `resize`, `edit` (33–52
   chars). Worth expanding.
7. **Arabic guide content** — verify with a native speaker that the 6 AR guides read
   naturally rather than as translations.
8. **Backlinks/digital PR** — off-code, and the main remaining ranking constraint.
9. **Field Core Web Vitals** — lab numbers are healthy; confirm with real CrUX data
   once traffic grows.
10. **`image-resizer` is a category of one** — `resize` holds a single tool while
    `edit` holds 17. Worth rebalancing for navigation clarity.

---

## 9. Status summary

| Area | Status |
|---|---|
| Sitemap | ✅ 228 URLs, all 200 / indexable / self-canonical / no redirects |
| Robots.txt | ✅ Correct — unchanged |
| Canonical | ✅ Self-referencing on all 240 pages, query strings stripped |
| hreflang | ✅ Reciprocal en / ar / x-default everywhere |
| Indexing | ✅ 0 unintended noindex; legal-page noindex intentional |
| Internal linking | ✅ Improved — +190 links, 0 orphans, 0 dead refs |
| Structured data | ✅ Valid, no fake data; breadcrumbs now include category |
| Titles / descriptions | ✅ 240 unique, 0 over-length |
| Mobile | ✅ Audited, no defect found — unchanged |
| Performance | ✅ Audited, healthy — unchanged |
| Broken links / status codes | ✅ 247-URL crawl, 100% HTTP 200 |
| Content accuracy | ✅ Privacy claims now match implementation |
| Tests | ✅ 85/85 passing · build clean |
