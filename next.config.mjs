import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/**
 * Security headers (PHASE 16 / 21).
 * frame-ancestors is left permissive so the app can be embedded in the dev
 * preview; set `frame-ancestors 'none'` for a hardened production deploy.
 *
 * Google AdSense + GTM hosts are allow-listed because the AdSense loader is
 * mounted in the locale layout and analytics scripts load after consent.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      // n6wxm.com is the host of Monetag's official Vignette tag
      // (`https://n6wxm.com/vignette.min.js`). It must be allow-listed or the
      // dynamically-created ad script is refused by the CSP.
      // cdn.jsdelivr.net serves the Tesseract.js OCR engine + language data.
      // Models are downloaded once and cached; user files are still never
      // uploaded — recognition runs 100% locally.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://n6wxm.com https://cdn.jsdelivr.net https://pagead2.googlesyndication.com https://www.googletagmanager.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://www.google.com https://ep2.adtrafficquality.google",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://n6wxm.com https://pagead2.googlesyndication.com https://www.google.com https://www.google-analytics.com https://googleads.g.doubleclick.net https://www.googletagmanager.com https://ep1.adtrafficquality.google",
      "font-src 'self' data:",
      "connect-src 'self' blob: data: https://open.er-api.com https://n6wxm.com https://cdn.jsdelivr.net https://pagead2.googlesyndication.com https://www.google-analytics.com https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.google.com https://ep1.adtrafficquality.google https://ep2.adtrafficquality.google",
      "frame-src 'self' https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://pagead2.googlesyndication.com https://ep2.adtrafficquality.google https://www.googleadservices.com",
      "worker-src 'self' blob:",
      "frame-ancestors *",
    ].join('; '),
  },
];

const staticCache = [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  trailingSlash: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      { source: '/icons/:path*', headers: staticCache },
      { source: '/images/:path*', headers: staticCache },
      { source: '/workers/:path*', headers: staticCache },
      { source: '/favicon.ico', headers: staticCache },
    ];
  },
};

export default withNextIntl(nextConfig);
