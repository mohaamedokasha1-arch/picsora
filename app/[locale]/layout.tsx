import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { siteConfig } from '@/lib/site';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ConsentProvider } from '@/components/consent/consent-provider';
import { CookieConsentGate } from '@/components/consent/cookie-consent-gate';
import { ConsentModal } from '@/components/consent/consent-modal';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { MonetagVignette } from '@/components/ads/monetag-vignette';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import '../globals.css';

const locales = siteConfig.locales as readonly string[];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1020' },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url.replace(/\/$/, '')),
  title: {
    default: siteConfig.name,
    template: '%s',
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  applicationName: siteConfig.name,
  authors: [{ name: siteConfig.name, url: siteConfig.url }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  category: 'utilities',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
    shortcut: '/favicon.ico',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
  },
  other: {
    'google-adsense-account': siteConfig.adsensePublisherId,
  },
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!locales.includes(params.locale)) notFound();
  setRequestLocale(params.locale);
  const messages = await getMessages();
  const t = await getTranslations('common');
  const dir = params.locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={params.locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Google Search Console verification */}
        <meta name="google-site-verification" content="6nwKbe3UwHbbzzDg0S8a6TRE_rEEIAdyGgIJD6q6ua4" />
        {/* Monetag site verification */}
        <meta name="monetag" content="a0ac60af89b9b55d82647e019146c160" />
        <link rel="dns-prefetch" href="https://pagead2.googlesyndication.com" />
        <link rel="preconnect" href="https://pagead2.googlesyndication.com" crossOrigin="anonymous" />
        {/* Google AdSense */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
            siteConfig.adsensePublisherId,
          )}`}
          crossOrigin="anonymous"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </head>
      <body className="min-h-screen">
        <a href="#main-content" className="skip-link">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <ConsentProvider>
              <AnalyticsProvider>
                <div id="app-root" className="flex min-h-screen flex-col">
                  <Header />
                  <main id="main-content" className="flex-1">
                    {children}
                  </main>
                  <Footer />
                </div>
                <ConsentModal />
              </AnalyticsProvider>
              <MonetagVignette />
              {/* Full-screen consent gate — blocks the whole site until the
                  visitor chooses Accept or Reject. Rendered outside #app-root
                  so it is never affected by the inert state it applies. */}
              <CookieConsentGate />
            </ConsentProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
