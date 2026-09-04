/**
 * Central sanitisation helpers (security hardening — behind the scenes only).
 *
 * Nothing in this module renders UI, changes copy, colours or layout. It only
 * makes the values that flow into the DOM, into downloads and into storage
 * safe against injection / spoofing tricks.
 */

/** Characters that must never survive into a value we hand to the platform. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
/** Bidi overrides used to spoof file names, e.g. `photo\u202Egnp.exe`. */
const BIDI_OVERRIDES = /[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;
/** Zero-width / invisible characters used to smuggle payloads past filters. */
const INVISIBLES = /[\u200B-\u200D\u2060\uFEFF]/g;

/** Keys that can poison `Object.prototype` when copied blindly. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

/**
 * Escape a string so it is safe to interpolate into HTML text or an attribute.
 * Also neutralises `/` (closing-tag breakout) and backtick (old IE attribute
 * parsing) for defence in depth.
 */
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/\//g, '&#47;');
}

/**
 * Serialise a value for embedding inside a `<script>` block (JSON-LD).
 * Prevents `</script>` breakout and JS line-terminator injection.
 */
export function serializeForScript(data: unknown): string {
  return JSON.stringify(data ?? null)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Strip everything dangerous from a user-controlled download file name while
 * keeping it human-readable (Unicode letters, including Arabic, are kept).
 *
 * Blocks: path traversal, directory separators, control characters, bidi
 * spoofing, Windows reserved device names, trailing dots/spaces and
 * over-long names.
 */
export function safeDownloadFilename(name: string, fallback = 'download'): string {
  let out = String(name ?? '')
    .replace(CONTROL_CHARS, '')
    .replace(BIDI_OVERRIDES, '')
    .replace(INVISIBLES, '');

  // Drop any directory component (both separators) and traversal segments.
  out = out.split(/[/\\]/).pop() ?? '';
  out = out.replace(/^\.+/, '');
  // Characters that are illegal or risky in file names on any major OS.
  out = out.replace(/[<>:"|?*\u0000]/g, '_');
  // Windows: names may not end with a dot or space.
  out = out.replace(/[. ]+$/, '');
  out = out.trim();

  // Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9).
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(out)) out = `_${out}`;

  if (out.length > 200) {
    const dot = out.lastIndexOf('.');
    const ext = dot > 0 && out.length - dot <= 12 ? out.slice(dot) : '';
    out = out.slice(0, 200 - ext.length) + ext;
  }

  return out || fallback;
}

/**
 * Conservative slug-style file name (ASCII-safe) — used when a name is built
 * from user input and must be predictable.
 */
export function sanitizeFilename(name: string, fallback = 'file'): string {
  const cleaned = safeDownloadFilename(name, '')
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

/**
 * Remove header-injection vectors (CR/LF and control chars) and clamp length.
 * Use on any value that leaves the browser inside a request body/header.
 */
export function sanitizeUserText(input: unknown, maxLength = 5000): string {
  return String(input ?? '')
    .replace(CONTROL_CHARS, ' ')
    .replace(BIDI_OVERRIDES, '')
    .replace(INVISIBLES, '')
    .trim()
    .slice(0, maxLength);
}

/** Single-line variant: also collapses whitespace runs. */
export function sanitizeSingleLine(input: unknown, maxLength = 200): string {
  return sanitizeUserText(input, maxLength).replace(/\s+/g, ' ');
}

/**
 * `JSON.parse` that cannot be used for prototype pollution.
 * Returns `null` instead of throwing on malformed input.
 */
export function safeJsonParse<T = unknown>(raw: string, maxBytes = 1_000_000): T | null {
  if (typeof raw !== 'string' || !raw || raw.length > maxBytes) return null;
  try {
    return JSON.parse(raw, (key, value) => (FORBIDDEN_KEYS.has(key) ? undefined : value)) as T;
  } catch {
    return null;
  }
}

/**
 * Copy an untrusted object into a null-prototype record, dropping dangerous
 * keys and any value that fails `isValid`.
 */
export function safeRecord<T>(
  input: unknown,
  isValid: (value: unknown) => value is T,
  options: { maxKeys?: number; keyPattern?: RegExp } = {},
): Record<string, T> {
  const { maxKeys = 1000, keyPattern } = options;
  const out: Record<string, T> = Object.create(null) as Record<string, T>;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  let count = 0;
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (count >= maxKeys) break;
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (keyPattern && !keyPattern.test(key)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (!isValid(value)) continue;
    out[key] = value;
    count += 1;
  }
  return out;
}

/**
 * Validate that a URL is a safe, absolute, external HTTPS endpoint.
 * Rejects `javascript:`, `data:`, credentials in the URL, and (in production)
 * plaintext HTTP and private/loopback hosts (SSRF-style targets).
 */
export function isSafeHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;
  const host = url.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.endsWith('.local') ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host);
  if (isLocal) return process.env.NODE_ENV !== 'production';
  return url.protocol === 'https:';
}

/**
 * Strip anything that could execute from a fragment of HTML that we are about
 * to inject with `dangerouslySetInnerHTML`.
 *
 * Used as a second line of defence for syntax-highlighter output (see the
 * PrismJS DOM-clobbering class of issues): the highlighter is only ever
 * expected to emit `<span class="token …">` elements.
 */
export function sanitizeHighlightHtml(html: string): string {
  return String(html ?? '')
    // Remove entire script/style/iframe/object/embed/link/meta/base blocks.
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form|svg|math)\b[^>]*>/gi, '')
    // Remove inline event handlers (onclick=…, onerror='…', onload=x).
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Remove javascript:/data:/vbscript: URLs in any remaining attribute.
    .replace(/\s(?:href|src|xlink:href|action|formaction)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // DOM clobbering: `name`/`id` attributes on injected nodes can shadow
    // globals and library internals — highlighting never needs them.
    .replace(/\s(?:id|name)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}
