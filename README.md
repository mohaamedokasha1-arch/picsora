# Piclizer — Free, private, browser-based image tools

Piclizer is a production-ready SaaS-style platform of **20 image tools** that run **100% in the browser**.
No uploads, no accounts, no servers touching your images. Every tool works with real files using the
Canvas, Blob, File and Web Worker APIs.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** (strict)
- **Tailwind CSS** (design tokens via CSS variables, dark mode via `class`)
- **shadcn/ui-style** components (built in-house — Button, Slider, Switch, Accordion, …)
- **next-intl** for English + Arabic with full RTL support
- **next-themes** for light/dark/system theming
- **pdf-lib** (client-side PDF), **JSZip** (client-side ZIP)
- **Web Workers** for CPU-heavy palette extraction
- No external image APIs, no paid AI APIs, no server-side uploads

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build:

```bash
npm run build
npm start
```

## Environment variables

Copy `.env.example` to `.env.local` and adjust. Everything is optional — the site works with zero config.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Canonical domain (default `https://piclizer.app`) |
| `NEXT_PUBLIC_SITE_NAME` | Brand name (default `Piclizer`) |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Search Console verification token |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Google Analytics ID (loads only after consent) |
| `NEXT_PUBLIC_GTM_ID` | Google Tag Manager ID (consent-gated) |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | `true` to activate analytics scripts |
| `NEXT_PUBLIC_ADS_ENABLED` / `NEXT_PUBLIC_ADS_CLIENT_ID` | AdSense (consent-gated, off by default) |
| `NEXT_PUBLIC_MONETAG_VIGNETTE_ZONE_ID` | Monetag Vignette Banner zone id (consent-gated, off unless set) |
| `NEXT_PUBLIC_CONTACT_ENDPOINT` | Optional URL that receives `POST {name, email, message}` |

## Architecture

```
/app               App Router pages ([locale]/…, sitemap.ts, robots.ts, manifest.ts)
/components         UI: layout, tools, ui primitives, consent, theme, ads, analytics
/lib
  /tools           registry (single source of truth) + per-tool processors
  /image           Canvas/format/encode utilities
  /seo             metadata + JSON-LD builders
  /validation      file validation (magic bytes, MIME, size)
/messages          en.json / ar.json translation files
/public            icons, OG image, workers/palette.worker.js
```

### The tool registry

`lib/tools/registry.ts` is the single source of truth. Every tool page, category page, search index,
sitemap and related-tools section derives from it.

## Adding a new tool (Tool #21)

1. Add an entry to `TOOLS` in `lib/tools/registry.ts` (slug, i18n keys, category, icon, formats, keywords, related tools).
2. Add its translations under `tools.<slug>` in `messages/en.json` **and** `messages/ar.json` (name, short, description, intro, howTo, faqs).
3. Create a processor in `lib/tools/processors/` (e.g. `my-tool.ts`) and register it in `processors/index.ts`.
4. Create the interactive UI in `components/tools/ui/` and register it in `components/tools/ui/index.ts` (dynamic import = automatic code splitting).
5. Done — its page, SEO metadata, sitemap entry, category listing and search all update automatically.

## Adding a language

1. Add the locale to `locales` in `lib/site.ts` and `middleware.ts`.
2. Create `messages/<locale>.json` mirroring the key structure of `en.json`.
3. Update `generateStaticParams` locales (they read `siteConfig.locales`).

## Enabling analytics

Set `NEXT_PUBLIC_ANALYTICS_ENABLED=true` and provide `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
Scripts load **only after** the user consents to analytics cookies (see the consent system).

## Enabling advertising

Set `NEXT_PUBLIC_ADS_ENABLED=true` and `NEXT_PUBLIC_ADS_CLIENT_ID`.
`AdPlacement` components reserve space on the homepage and tool pages and render AdSense units only
after advertising consent is given.

### Monetag Vignette Banner

To enable the Monetag Vignette ad:

1. In your Monetag dashboard, create a **Vignette Banner** zone and copy its numeric zone id.
2. Set `NEXT_PUBLIC_MONETAG_VIGNETTE_ZONE_ID=<zone id>` in your environment.
3. Done. `MonetagVignette` (mounted from `app/[locale]/layout.tsx`) injects Monetag's official
   vignette tag into `<head>` — but only after the visitor consents to advertising cookies,
   consistent with the rest of the ad system. The CSP in `next.config.mjs` already allow-lists
   `https://inklinkor.com` (Monetag's tag host).

## Activating PWA mode

The manifest, icons and theme colors are in place. To add a service worker:

1. `npm i next-pwa`
2. Uncomment the `next-pwa` config block in `next.config.mjs`.
3. Register the worker in `app/[locale]/layout.tsx` (registration point is prepared).

## Cookie consent

First-party cookie `consent_preferences` (365 days). Necessary cookies are always on; functional,
analytics and advertising are opt-in and genuinely do not load until consent is granted.
Users can reopen the manager from the footer ("Cookie Settings").

## Deployment

Vercel-ready: no special server configuration.

1. Push to a Git repository and import into Vercel.
2. Set `NEXT_PUBLIC_SITE_URL` to your production domain.
3. Deploy. `npm run build` runs automatically.

## Security notes

- Security headers (CSP, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) in `next.config.mjs`.
  For a hardened production deploy, tighten `frame-ancestors` in the CSP.
- Files are validated by extension, MIME type **and** magic bytes.
- Downloads use `URL.createObjectURL`; object URLs are revoked after use.
