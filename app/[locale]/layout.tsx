import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { siteConfig } from '@/lib/site';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { ConsentProvider } from '@/components/consent/consent-provider';
import { CookieBanner } from '@/components/consent/cookie-banner';
import { ConsentModal } from '@/components/consent/consent-modal';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
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
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: '%s',
  },
  applicationName: siteConfig.name,
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/apple-touch-icon.png',
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
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
        {/* Monetag site verification */}
        <meta name="monetag" content="a0ac60af89b9b55d82647e019146c160" />
      </head>
      <body className="min-h-screen">
        <a href="#main-content" className="skip-link">
          {t('skipToContent')}
        </a>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <ConsentProvider>
              <AnalyticsProvider>
                <div className="flex min-h-screen flex-col">
                  <Header />
                  <main id="main-content" className="flex-1">
                    {children}
                  </main>
                  <Footer />
                </div>
                <CookieBanner />
                <ConsentModal />
              </AnalyticsProvider>
            </ConsentProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
