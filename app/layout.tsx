import type { Metadata } from 'next';
import { siteConfig } from '@/lib/site';

/**
 * Pass-through root layout (required by Next.js).
 * The real <html> document is rendered by app/[locale]/layout.tsx.
 * app/not-found.tsx provides its own minimal document for invalid locales.
 *
 * SEO: the root URL (no locale prefix) must never be indexed — it is always
 * redirected to the default locale by middleware. Setting `robots: noindex`
 * here ensures Google never treats the bare domain as a duplicate of `/en`.
 * The `canonical` points to the default-locale home so any signal the root
 * URL accrues is forwarded to the real page.  Child layouts / pages override
 * both fields with their own values.
 */

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url.replace(/\/$/, '')),
  alternates: {
    canonical: `/${siteConfig.defaultLocale}`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
