/**
 * Single source of truth for the HTTP security headers.
 *
 * Plain ESM (no TypeScript) on purpose: it is imported by BOTH
 * `next.config.mjs` (build-time route headers) and `middleware.ts` (runtime
 * responses), so a request can never slip through with a weaker set.
 *
 * Nothing here affects markup, styling, copy or behaviour of the site — these
 * are transport-level protections only.
 */

/**
 * @typedef {{ key: string, value: string }} HeaderEntry
 */

/**
 * Third-party origins the app legitimately talks to.
 * Keeping them in one place makes the CSP auditable.
 */
const ORIGINS = {
  monetag: ['https://n6wxm.com'],
  jsdelivr: ['https://cdn.jsdelivr.net'],
  fx: ['https://open.er-api.com'],
  googleScripts: [
    'https://pagead2.googlesyndication.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://googleads.g.doubleclick.net',
    'https://www.google.com',
    'https://ep2.adtrafficquality.google',
  ],
  googleImages: [
    'https://pagead2.googlesyndication.com',
    'https://www.google.com',
    'https://www.google-analytics.com',
    'https://googleads.g.doubleclick.net',
    'https://www.googletagmanager.com',
    'https://ep1.adtrafficquality.google',
  ],
  googleConnect: [
    'https://pagead2.googlesyndication.com',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://www.googletagmanager.com',
    'https://googleads.g.doubleclick.net',
    'https://www.google.com',
    'https://ep1.adtrafficquality.google',
    'https://ep2.adtrafficquality.google',
  ],
  googleFrames: [
    'https://googleads.g.doubleclick.net',
    'https://tpc.googlesyndication.com',
    'https://www.google.com',
    'https://pagead2.googlesyndication.com',
    'https://ep2.adtrafficquality.google',
    'https://www.googleadservices.com',
  ],
};

/**
 * Build the Content-Security-Policy.
 *
 * `isProd` tightens the parts that must stay loose for the local dev server
 * and the sandboxed preview (framing + websocket HMR).
 *
 * The allow-lists are byte-for-byte compatible with the previous policy so no
 * asset, ad slot or tool stops loading. Only the missing/weak directives are
 * fixed:
 *  - `frame-ancestors` is locked to same-origin in production (clickjacking).
 *  - `upgrade-insecure-requests` + `block-all-mixed-content` in production.
 *  - `wasm-unsafe-eval` declared explicitly for the OCR/PDF WebAssembly
 *    engines instead of relying solely on the broad `unsafe-eval`.
 *  - `manifest-src`, `media-src`, `child-src` added (previously fell back to
 *    `default-src`, which was correct but implicit).
 *
 * @param {boolean} isProd
 * @returns {string}
 */
export function buildCsp(isProd) {
  const scriptSrc = [
    "'self'",
    // Required by the Next.js runtime bootstrap and next-themes' blocking
    // inline script. Removing it would break hydration and cause a theme flash.
    "'unsafe-inline'",
    // Required by the WebAssembly-backed tools (Tesseract OCR / pdf.js glue).
    "'wasm-unsafe-eval'",
    "'unsafe-eval'",
    ...ORIGINS.monetag,
    ...ORIGINS.jsdelivr,
    ...ORIGINS.googleScripts,
  ];

  const connectSrc = [
    "'self'",
    'blob:',
    'data:',
    ...ORIGINS.fx,
    ...ORIGINS.monetag,
    ...ORIGINS.jsdelivr,
    ...ORIGINS.googleConnect,
  ];

  if (!isProd) {
    // Dev-server hot-reload transport.
    connectSrc.push('ws:', 'wss:');
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc.join(' ')}`,
    // Next/Tailwind inject styles at runtime and there is no style nonce path
    // in the App Router today, so inline styles stay allowed.
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${[...ORIGINS.monetag, ...ORIGINS.googleImages].join(' ')}`,
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    `frame-src 'self' ${ORIGINS.googleFrames.join(' ')}`,
    // The HTML-preview tool renders untrusted markup inside a fully sandboxed
    // iframe; `child-src` mirrors `frame-src` for older engines.
    `child-src 'self' blob: ${ORIGINS.googleFrames.join(' ')}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self' blob: data:",
    // Clickjacking protection. Left permissive outside production so the
    // dev/preview iframe keeps working.
    isProd ? "frame-ancestors 'self'" : 'frame-ancestors *',
  ];

  if (isProd) {
    directives.push('upgrade-insecure-requests');
    directives.push('block-all-mixed-content');
  }

  return directives.join('; ');
}

/**
 * Features the app never uses. Denying them stops a compromised third-party
 * script (or an embedded ad frame) from reaching sensors, hardware or
 * credentials on the visitor's device.
 *
 * `browsing-topics` / `attribution-reporting` are intentionally NOT disabled:
 * the AdSense + Monetag tags rely on them, and blocking them would change how
 * the (visually unchanged) ad slots behave.
 */
export const PERMISSIONS_POLICY = [
  'accelerometer=()',
  'ambient-light-sensor=()',
  'autoplay=()',
  'bluetooth=()',
  'camera=()',
  'display-capture=()',
  'encrypted-media=()',
  'gamepad=()',
  'geolocation=()',
  'gyroscope=()',
  'hid=()',
  'idle-detection=()',
  'local-fonts=()',
  'magnetometer=()',
  'microphone=()',
  'midi=()',
  'payment=()',
  'publickey-credentials-get=()',
  'screen-wake-lock=()',
  'serial=()',
  'usb=()',
  'xr-spatial-tracking=()',
].join(', ');

/**
 * The complete header set applied to every HTML response.
 *
 * @param {boolean} isProd
 * @returns {HeaderEntry[]}
 */
export function securityHeaders(isProd) {
  /** @type {HeaderEntry[]} */
  const headers = [
    { key: 'Content-Security-Policy', value: buildCsp(isProd) },
    // MIME sniffing → stops a text/plain response being executed as script.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'X-DNS-Prefetch-Control', value: 'on' },
    // Blocks Adobe/Flash-era cross-domain policy files.
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
    // Gives the origin its own agent cluster (isolates it from same-site pages).
    { key: 'Origin-Agent-Cluster', value: '?1' },
    // Cross-origin isolation; `allow-popups` keeps ad interstitials working.
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    // Legacy XSS auditor: `0` is the modern recommendation (CSP is used).
    { key: 'X-XSS-Protection', value: '0' },
  ];

  if (isProd) {
    // Legacy clickjacking guard for engines without `frame-ancestors`.
    headers.push({ key: 'X-Frame-Options', value: 'SAMEORIGIN' });
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}

/**
 * Extra headers for immutable static assets. Adds `Cross-Origin-Resource-Policy`
 * so other origins cannot hot-link them into their own documents.
 *
 * @returns {HeaderEntry[]}
 */
export function staticAssetHeaders() {
  return [
    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  ];
}
