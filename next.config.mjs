import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/**
 * Security headers (PHASE 16 / 21).
 * frame-ancestors is left permissive so the app can be embedded in the dev
 * preview; set `frame-ancestors 'none'` for a hardened production deploy.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // n6wxm.com is the host of Monetag's official Vignette tag
      // (`https://n6wxm.com/vignette.min.js`). It must be allow-listed or the
      // dynamically-created ad script is refused by the CSP.
      // cdn.jsdelivr.net serves the Tesseract.js OCR engine + language data.
      // Models are downloaded once and cached; user files are still never
      // uploaded — recognition runs 100% locally.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://n6wxm.com https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https://n6wxm.com",
      "font-src 'self' data:",
      "connect-src 'self' blob: data: https://open.er-api.com https://n6wxm.com https://cdn.jsdelivr.net",
      "worker-src 'self' blob:",
      "frame-ancestors *",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
