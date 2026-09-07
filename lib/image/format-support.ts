import type { ImageFormat } from '@/lib/types';

/**
 * Output-format capability detection — one place, every format.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * `canvas.toBlob()` / `canvas.toDataURL()` do NOT report failure when a browser
 * cannot encode a requested type. They behave in three different ways depending
 * on engine, version and platform:
 *
 *   1. Safari 13.1–14.x and older WebKit/Firefox builds: `toBlob('image/webp')`
 *      hands back **PNG bytes** (per spec, an unsupported type silently falls
 *      back to `image/png`) while the file is still named `.webp` → the user
 *      downloads a mislabelled file that no viewer opens.
 *   2. `OffscreenCanvas.convertToBlob({ type })` does the opposite: it
 *      **rejects** with a TypeError for an unsupported type. A synchronous
 *      `try { … } catch { … }` around it catches nothing (the throw is async),
 *      so the rejection escaped as an unhandled error and the whole tool died
 *      with the generic "Something went wrong" panel.
 *   3. Some hardened/enterprise Firefox builds disable `toDataURL` for certain
 *      types, so a capability probe based on `toDataURL` alone can produce a
 *      false negative for a format the browser CAN actually encode.
 *
 * This module probes each encoder once, caches the answer, and expresses the
 * result as "which format may I safely write?" — so the UI can be honest and
 * the pipeline can fall back to a format that is guaranteed to work instead of
 * either crashing or emitting mislabelled bytes.
 *
 * SAFETY CONTRACT
 * ---------------
 * Every probe is wrapped: a browser that throws while probing is reported as
 * "cannot encode that format", never as an exception. When there is no DOM at
 * all (unit tests running outside a browser, server render) probing is
 * impossible, so the module reports "everything standard is supported" — i.e.
 * it never changes behaviour for consumers that were already working.
 */

/** Formats the canvas pipeline may be asked to write. */
export type CanvasOutputFormat = ImageFormat | 'avif' | 'bmp' | 'tiff' | 'ico';

export interface FormatCapability {
  /** The browser can encode this format at all. */
  encodable: boolean;
  /** The encoded output keeps an alpha channel. */
  alpha: boolean;
  /** True when the answer came from a real probe (false = assumed). */
  probed: boolean;
}

/**
 * Formats that always keep transparency when they are actually encodable.
 * JPEG (and the HEIC/HEIF we map onto it) is the classic lossy-opaque case: an
 * alpha channel there collapses to black unless a background is painted first.
 */
const ALPHA_FORMATS: readonly string[] = ['png', 'webp', 'gif', 'avif', 'bmp', 'tiff', 'ico'];

/**
 * Formats a canvas can NEVER encode in any shipping browser, whatever the
 * capability probe says, together with the container we rewrite them to.
 * (`gif`/`svg` are encodable in principle but `toBlob` yields PNG for them in
 * every engine, and HEIC/HEIF encoding simply does not exist in browsers —
 * this is exactly the mapping the pipeline has always applied, kept here so
 * there is a single source of truth.)
 */
const STATIC_MAP: Record<string, CanvasOutputFormat> = {
  heic: 'jpg',
  heif: 'jpg',
  gif: 'png',
  svg: 'png',
};

const NEVER_ENCODABLE: readonly string[] = Object.keys(STATIC_MAP);

/**
 * Last-resort replacement chain, ordered by "safest, most universal first".
 * PNG is lossless, keeps alpha and is encodable in every browser that has a
 * canvas at all, so it is the correct fallback for anything unsupported.
 */
const FALLBACK_CHAIN: readonly CanvasOutputFormat[] = ['png', 'jpg'];

const MIME_BY_FORMAT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  ico: 'image/vnd.microsoft.icon',
  heic: 'image/heic',
  heif: 'image/heif',
};

export function mimeForFormat(format: CanvasOutputFormat): string {
  return MIME_BY_FORMAT[format] ?? 'image/png';
}

function hasDomCanvas(): boolean {
  return typeof document !== 'undefined' && typeof document.createElement === 'function';
}

const cache = new Map<string, FormatCapability>();

/** Real probe: does a 1×1 canvas produce this MIME type? */
function probeEncodable(mime: string): boolean | null {
  if (!hasDomCanvas()) return null; // cannot probe → caller decides
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    // Paint one fully transparent black pixel: an encoder that supports alpha
    // must be able to round-trip it, an opaque one just flattens it.
    ctx.clearRect(0, 0, 1, 1);
    const dataUrl = canvas.toDataURL(mime);
    if (typeof dataUrl !== 'string' || dataUrl.length < 'data:,'.length) return false;
    // Unsupported type ⇒ the browser answers with `data:image/png…` (or an
    // empty `data:,`). A genuine encoder answers with the requested MIME.
    return dataUrl.startsWith(`data:${mime}`);
  } catch {
    return false;
  }
}

/**
 * Capability of one output format (memoised — probing allocates a canvas and
 * this can be called inside per-image encode loops).
 */
export function formatCapability(format: CanvasOutputFormat): FormatCapability {
  const key = String(format || '').toLowerCase();
  const cached = cache.get(key);
  if (cached) return cached;

  const alpha = ALPHA_FORMATS.includes(key);

  // A container this module knows nothing about cannot be requested on purpose,
  // so it is reported as unencodable rather than probed (the probe would ask
  // for `image/png` and answer "yes", which is how mislabelled files are born).
  if (!Object.prototype.hasOwnProperty.call(MIME_BY_FORMAT, key)) {
    const unknown: FormatCapability = { encodable: false, alpha: false, probed: false };
    cache.set(key, unknown);
    return unknown;
  }

  // HEIC/HEIF/GIF/SVG: the *target* we rewrite them to is what must be
  // encodable, and the requested container itself never is.
  if (NEVER_ENCODABLE.includes(key)) {
    const result: FormatCapability = { encodable: false, alpha, probed: false };
    cache.set(key, result);
    return result;
  }

  const probed = probeEncodable(mimeForFormat(key as CanvasOutputFormat));
  const result: FormatCapability =
    probed === null
      ? // No DOM ⇒ no probe possible. Be as conservative as a failing probe was
        // before (only the bullet-proof canvas encoders are assumed), so
        // non-browser consumers see exactly the same mapping as always.
        { encodable: key === 'jpg' || key === 'jpeg' || key === 'png', alpha, probed: false }
      : { encodable: probed, alpha, probed: true };

  cache.set(key, result);
  return result;
}

/** True when the current browser can write this format from a canvas. */
export function isFormatEncodable(format: CanvasOutputFormat | string): boolean {
  return formatCapability(String(format) as CanvasOutputFormat).encodable;
}

/** Forget cached probe results (tests, or after a runtime correction). */
export function resetFormatCapabilities(format?: string): void {
  if (format) cache.delete(String(format).toLowerCase());
  else cache.clear();
}

/** Record that the browser actually failed to encode `format` at runtime. */
export function markFormatUnsupported(format: string): void {
  const key = String(format || '').toLowerCase();
  const previous = cache.get(key);
  cache.set(key, { encodable: false, alpha: previous?.alpha ?? false, probed: true });
}

/**
 * Which format should replace an unencodable one, or `null` when the request is
 * already fine. Alpha is preserved whenever possible (transparent PNG → PNG,
 * never JPEG), so nothing silently loses transparency.
 */
export function fallbackFormat(format: CanvasOutputFormat): CanvasOutputFormat | null {
  for (const candidate of FALLBACK_CHAIN) {
    if (candidate === format) continue;
    if (!formatCapability(candidate).encodable && hasDomCanvas()) continue;
    return candidate;
  }
  return null;
}

export interface ResolvedFormat {
  /** Format that must actually be encoded (and named/exported as). */
  format: ImageFormat;
  /** Set when the caller's requested format could not be honoured. */
  fallbackFrom?: ImageFormat;
  /** Stable key the UI can translate: `formats.fallbackWebp`, … */
  reason?: 'not-encodable';
}

/**
 * Map any requested output format to a format this browser can really write.
 * Never throws; unknown/blank input degrades to the safe universal choice (PNG).
 */
export function resolveEncodeFormat(requested?: string | null): ResolvedFormat {
  try {
    const raw = String(requested ?? '').toLowerCase().trim();
    if (!raw || raw === 'same') return { format: 'png' };

    // Containers the canvas pipeline can never write get rewritten first
    // (heic/heif → jpg, gif/svg → png) — the same mapping the tools relied on
    // before, now in one place.
    const mapped = STATIC_MAP[raw];
    const known = (mapped ?? raw) as CanvasOutputFormat;
    if (!Object.prototype.hasOwnProperty.call(MIME_BY_FORMAT, known)) {
      // Unknown extension: hand back a format that always works rather than
      // emitting bytes under a name no application can open.
      return { format: 'png' };
    }

    const capability = formatCapability(known);
    if (capability.encodable) {
      const kept = known as ImageFormat;
      return mapped ? { format: kept, fallbackFrom: raw as ImageFormat, reason: 'not-encodable' } : { format: kept };
    }

    const replacement = fallbackFormat(known);
    if (!replacement) return { format: known as ImageFormat };
    return {
      format: replacement as ImageFormat,
      fallbackFrom: raw as ImageFormat,
      reason: 'not-encodable',
    };
  } catch {
    return { format: 'png' };
  }
}

/**
 * `true` when an image with transparency must be flattened onto a background
 * before encoding (otherwise alpha collapses to BLACK in the output).
 */
export function needsOpaqueBackground(format: ImageFormat | string): boolean {
  const fmt = String(format ?? '').toLowerCase();
  if (fmt === 'jpg' || fmt === 'jpeg') return true;
  return !formatCapability(fmt as CanvasOutputFormat).alpha;
}

/** Does the produced blob really contain the format we asked for? */
export function blobMatchesFormat(blob: Blob, format: ImageFormat): boolean {
  try {
    const type = String(blob?.type ?? '').toLowerCase().split(';')[0].trim();
    // Engines differ on whether toBlob fills `type`; an empty value is not a
    // contradiction, so only an explicit mismatch counts.
    if (!type) return true;
    const expected = mimeForFormat(format);
    if (type === expected) return true;
    // `image/jpg` is not a real MIME type but some pickers use it.
    if (expected === 'image/jpeg' && type === 'image/jpg') return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Human label for a container, spelled the way the rest of the app spells it
 * ("WebP", "PNG", "JPG") — the option labels, the file extensions and these
 * notices must not disagree about the same format.
 */
const PRETTY_LABELS: Record<string, string> = {
  jpg: 'JPG',
  jpeg: 'JPEG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  gif: 'GIF',
  heic: 'HEIC',
  heif: 'HEIF',
  tiff: 'TIFF',
  bmp: 'BMP',
  svg: 'SVG',
  pdf: 'PDF',
  ico: 'ICO',
};

export function formatLabel(format: string): string {
  const f = String(format ?? '').toLowerCase();
  return PRETTY_LABELS[f] ?? (f ? f.toUpperCase() : 'PNG');
}
