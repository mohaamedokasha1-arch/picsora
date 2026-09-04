# Security Policy — Piclizer

## Reporting a vulnerability

Please report security issues privately to **privacy@piclizer.app**.
Machine-readable contact information: [`/.well-known/security.txt`](./public/.well-known/security.txt).

Please do not open a public GitHub issue for a security report.

## Threat model

Piclizer is a **fully static, client-side application**. There is no backend,
no database, no user accounts and no server-side storage of user content.
Every image, PDF and text file is processed inside the visitor's own browser
(Canvas / WebAssembly / Web Workers) and never leaves the device.

That shape removes whole vulnerability classes by construction (SQL injection,
IDOR, broken authentication, server-side file upload RCE, SSRF from user input),
and concentrates the remaining risk in four places:

| Surface | Risk | Control |
| --- | --- | --- |
| Third-party scripts (AdSense, Monetag, GA) | Supply-chain script injection | Strict CSP allow-list, consent gate, validated ids, pinned constant URLs |
| Untrusted files opened by the tools | Malicious SVG / polyglot / PDF, memory exhaustion | Magic-byte sniffing, extension + MIME allow-list, SVG active-content scan, size & count caps |
| Untrusted strings rendered by the tools | XSS / DOM clobbering | React auto-escaping, sandboxed iframe preview, sanitised highlighter output |
| Transport | MITM, clickjacking, sniffing, framing | HSTS, CSP `frame-ancestors`, `X-Frame-Options`, `nosniff`, COOP, Permissions-Policy |

## Where the controls live

| File | Responsibility |
| --- | --- |
| `lib/security/headers.mjs` | Single source of truth for every HTTP security header and the CSP |
| `lib/security/sanitize.ts` | HTML escaping, JSON-LD serialisation, safe file names, prototype-pollution-proof JSON parsing, URL safety |
| `lib/security/net.ts` | Hardened `fetch` (timeout, no cookies, no referrer, no redirects, size cap) |
| `middleware.ts` | Malformed-URL rejection, scanner-path 404s, method allow-list, API guard, open-redirect guard |
| `lib/validation.ts` | Upload validation (name structure, magic bytes, MIME, SVG content, size/count caps) |
| `next.config.mjs` | Applies the header set and locks down the image optimizer |

## Rules for contributors

1. **Never** call `dangerouslySetInnerHTML` with a value that is not either a
   constant, JSON-LD produced by `serializeForScript`, or output passed
   through `sanitizeHighlightHtml`.
2. **Never** add a third-party origin without also adding it to the CSP
   allow-list in `lib/security/headers.mjs` — and justify it in a comment.
3. Use `safeFetch` / `safeFetchJson` for any network call; never bare `fetch`.
4. Use `triggerDownload` for downloads; it sanitises the file name centrally.
5. Parse untrusted JSON (network, `localStorage`, cookies) with
   `safeJsonParse`, never bare `JSON.parse`.
6. Any new upload path must go through `validateFiles` / `validateFile`.
7. Run `npm audit` before releasing; keep `next`, `next-intl` and `prismjs`
   current.

## Deployment requirements

The production hardening (HSTS, `frame-ancestors 'self'`, `X-Frame-Options`,
`upgrade-insecure-requests`) is enabled when `NODE_ENV === 'production'`.
Make sure the host serves the app over HTTPS only and does not strip the
headers emitted by `next.config.mjs` / `middleware.ts`.
