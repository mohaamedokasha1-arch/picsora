import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'ar'],
  defaultLocale: 'en',
  localePrefix: 'always',
});

export const config = {
  // Skip paths with a file extension (e.g. /workers/palette.worker.js) and Next internals.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
