import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { securityHeaders } from './lib/security/headers.mjs';

const LOCALES = ['en', 'ar'] as const;

const intlMiddleware = createMiddleware({
  locales: [...LOCALES],
  defaultLocale: 'en',
  localePrefix: 'always',
});

const IS_PROD = process.env.NODE_ENV === 'production';
const SECURITY_HEADERS = securityHeaders(IS_PROD);

/** Methods the site (a fully static, client-side app) ever needs. */
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Request paths that are always malicious/noise on a static Next.js site.
 * Answering 404 immediately keeps scanners away from the rendering pipeline.
 */
const BLOCKED_PATH = new RegExp(
  [
    '\\.(php\\d?|asp|aspx|jsp|cgi|sh|bash|exe|dll|sql|bak|old|swp|ini|conf|log)$',
    '(^|/)\\.env',
    '(^|/)\\.git(/|$)',
    '(^|/)\\.aws(/|$)',
    '(^|/)\\.ssh(/|$)',
    '(^|/)(wp-admin|wp-login|wp-content|wp-includes|xmlrpc)(/|$|\\.)',
    '(^|/)(phpmyadmin|adminer|vendor/phpunit)(/|$)',
    '(^|/)(config|configuration|credentials|id_rsa|dump\\.sql)$',
  ].join('|'),
  'i',
);

/** Reject obviously hostile URL shapes before anything else parses them. */
function isMalformedPath(pathname: string): boolean {
  if (pathname.length > 2048) return true;
  // Null bytes / control characters smuggled through the path.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F]/.test(pathname)) return true;
  // Encoded and double-encoded path traversal.
  const lower = pathname.toLowerCase();
  if (lower.includes('..')) return true;
  if (/%2e%2e|%252e|%2f%2e|%00|%5c/.test(lower)) return true;
  // Back-slash used to confuse the path/host boundary.
  if (pathname.includes('\\')) return true;
  return false;
}

/** Apply the security header set to any response we return. */
function harden(response: NextResponse): NextResponse {
  for (const { key, value } of SECURITY_HEADERS) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Guard against open redirects.
 *
 * next-intl only ever emits same-origin locale redirects, but a `Location`
 * that resolves to another host (scheme-relative `//evil.com`, control
 * characters stripped by the URL parser, …) must never leave this middleware.
 * See CVE-2026-40299 for the class of bug this defends against.
 */
function assertSameOriginRedirect(response: NextResponse, request: NextRequest): NextResponse {
  const location = response.headers.get('location');
  if (!location) return response;

  let target: URL;
  try {
    target = new URL(location, request.nextUrl.origin);
  } catch {
    return harden(NextResponse.redirect(new URL('/en', request.nextUrl.origin), 307));
  }

  const sameOrigin = target.origin === request.nextUrl.origin;
  const schemeRelative = /^\s*(\/\/|[a-z][a-z0-9+.-]*:)/i.test(location);

  if (!sameOrigin || schemeRelative) {
    return harden(NextResponse.redirect(new URL('/en', request.nextUrl.origin), 307));
  }

  // Normalise to a relative Location so no absolute host can be injected.
  response.headers.set('location', `${target.pathname}${target.search}${target.hash}`);
  return response;
}

/**
 * Permanently moved paths.
 *
 * The "PDF" and "PDF Tools" categories used to be two separate entries with
 * the exact same display name; they are now the single `pdf-tools` category.
 * The old URL is 301'd so indexed links, bookmarks and backlinks keep working
 * and pass their SEO value to the merged page.
 *
 * Handled here rather than in `next.config.mjs` redirects() so the response
 * still carries the full security header set.
 */
const PERMANENT_REDIRECTS: [RegExp, (locale: string) => string][] = [
  [/^\/(en|ar)\/categories\/pdf\/?$/, (locale) => `/${locale}/categories/pdf-tools`],
  [/^\/categories\/pdf\/?$/, () => '/en/categories/pdf-tools'],
];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1) Malformed / traversal-style URLs — refuse without further processing.
  if (isMalformedPath(pathname)) {
    return harden(new NextResponse('Bad Request', { status: 400 }));
  }

  // 2) Known attack-scanner paths — cheap 404, no rendering work.
  if (BLOCKED_PATH.test(pathname)) {
    return harden(new NextResponse('Not Found', { status: 404 }));
  }

  // 3) HTTP method allow-list. The site serves static documents only; anything
  //    else (TRACE/TRACK/PUT/DELETE/…) is rejected before it reaches a route.
  if (!ALLOWED_METHODS.has(request.method)) {
    const response = harden(new NextResponse(null, { status: 405 }));
    response.headers.set('Allow', 'GET, HEAD, OPTIONS');
    return response;
  }

  // 4) Permanent redirects for merged/renamed pages.
  for (const [pattern, destination] of PERMANENT_REDIRECTS) {
    const match = pattern.exec(pathname);
    if (match) {
      const url = request.nextUrl.clone();
      url.pathname = destination(match[1] ?? 'en');
      return harden(NextResponse.redirect(url, 301));
    }
  }

  // 5) API surface: no locale negotiation, strict same-origin policy, and no
  //    caching of responses. (There are no API routes today — this makes sure
  //    any future one is protected by default rather than by memory.)
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin');
    if (origin && origin !== request.nextUrl.origin) {
      return harden(new NextResponse('Forbidden', { status: 403 }));
    }
    const response = harden(NextResponse.next());
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Vary', 'Origin');
    return response;
  }

  // 6) Normal page request — unchanged locale routing, hardened response.
  const response = intlMiddleware(request) as NextResponse;
  return assertSameOriginRedirect(harden(response), request);
}

export const config = {
  // Skip Next internals and any path with a file extension (e.g.
  // /workers/palette.worker.js), but DO cover /api so the guards above apply.
  matcher: ['/((?!_next|_vercel|.*\\..*).*)', '/api/:path*'],
};
