export const siteConfig = {
  name: 'Piclizer',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://piclizer.app',
  ogImage: '/images/og-image.svg',
  description:
    'Free online tools that run 100% in your browser. Compress images, convert iPhone HEIC photos, edit PDFs, extract text and format code — privately.',
  keywords: [
    'image tools',
    'image compressor',
    'image resizer',
    'image converter',
    'heic to jpg',
    'compress image to exact kb',
    'pdf tools',
    'pdf to text',
    'ocr online',
    'developer tools',
    'jpg to png',
    'online image editor',
    'free image tools',
  ],
  defaultLocale: 'en',
  locales: ['en', 'ar'] as const,
  contactEmail: 'privacy@piclizer.app',
};

export type Locale = (typeof siteConfig.locales)[number];
