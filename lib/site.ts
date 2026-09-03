export const siteConfig = {
  name: 'Piclizer',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://piclizer.app',
  ogImage: '/images/og-image.svg',
  description:
    'Free online image tools that run 100% in your browser. Compress, resize, crop, convert and edit images privately.',
  keywords: [
    'image tools',
    'image compressor',
    'image resizer',
    'image converter',
    'jpg to png',
    'online image editor',
    'free image tools',
  ],
  defaultLocale: 'en',
  locales: ['en', 'ar'] as const,
  contactEmail: 'privacy@piclizer.app',
};

export type Locale = (typeof siteConfig.locales)[number];
