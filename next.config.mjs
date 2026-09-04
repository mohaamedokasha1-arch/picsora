import createNextIntlPlugin from 'next-intl/plugin';
import { securityHeaders, staticAssetHeaders } from './lib/security/headers.mjs';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const isProd = process.env.NODE_ENV === 'production';

/**
 * Security headers live in `lib/security/headers.mjs` so `next.config.mjs` and
 * `middleware.ts` cannot drift apart. See that file for the rationale behind
 * every directive and every allow-listed third-party origin.
 */
const appSecurityHeaders = securityHeaders(isProd);
const staticCache = staticAssetHeaders();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Do not advertise the framework/version to attackers.
  poweredByHeader: false,
  compress: true,
  trailingSlash: false,
  // Keep stack traces and source paths out of the production bundle.
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // The app never renders remote images; an empty allow-list makes the
    // built-in optimizer unusable as an open proxy / SSRF pivot.
    remotePatterns: [],
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      { source: '/(.*)', headers: appSecurityHeaders },
      { source: '/icons/:path*', headers: staticCache },
      { source: '/images/:path*', headers: staticCache },
      { source: '/workers/:path*', headers: staticCache },
      { source: '/favicon.ico', headers: staticCache },
      // `.well-known` documents must stay readable cross-origin.
      {
        source: '/.well-known/:path*',
        headers: [{ key: 'X-Content-Type-Options', value: 'nosniff' }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
