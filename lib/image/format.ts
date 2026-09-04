/**
 * Browser feature detection + format helpers.
 * Everything here is client-side only.
 */

import type { DecodedImage, ImageFormat } from '@/lib/types';

export const MAX_DIMENSION = 16000; // safety cap for canvas dimensions

export function fileExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

/**
 * Canonical image families. Every extension/MIME variant a camera, browser or
 * messaging app can produce is folded down to one of these, so validation and
 * encoding never have to reason about `.jpeg` vs `.jpg` vs `.jfif` again.
 */
export type CanonicalImageFormat =
  | 'jpg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'bmp'
  | 'tiff'
  | 'avif'
  | 'heic'
  | 'svg'
  | 'ico';

/** All known extension spellings → canonical family. */
const EXTENSION_ALIASES: Record<string, CanonicalImageFormat> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  jpe: 'jpg',
  jif: 'jpg',
  jfi: 'jpg',
  jfif: 'jpg',
  png: 'png',
  apng: 'png',
  webp: 'webp',
  gif: 'gif',
  bmp: 'bmp',
  dib: 'bmp',
  tif: 'tiff',
  tiff: 'tiff',
  avif: 'avif',
  avifs: 'avif',
  heic: 'heic',
  heif: 'heic',
  heics: 'heic',
  heifs: 'heic',
  hif: 'heic',
  svg: 'svg',
  svgz: 'svg',
  ico: 'ico',
  cur: 'ico',
};

/** Canonical MIME per family (used for `accept=` and for encoding output). */
const MIME_BY_FORMAT: Record<CanonicalImageFormat, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  avif: 'image/avif',
  heic: 'image/heic',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
};

/**
 * Fold any extension (or filename) into its canonical image family.
 * Returns `null` when the extension is unknown — callers must then fall back to
 * the MIME type or the file's magic bytes instead of rejecting outright.
 */
export function canonicalImageFormat(extOrName: string): CanonicalImageFormat | null {
  const ext = (extOrName.includes('.') ? fileExt(extOrName) : extOrName).toLowerCase().trim();
  if (!ext) return null;
  return EXTENSION_ALIASES[ext] ?? null;
}

/** Every extension spelling that belongs to a canonical family. */
export function extensionsForFormat(format: CanonicalImageFormat): string[] {
  return Object.keys(EXTENSION_ALIASES).filter((e) => EXTENSION_ALIASES[e] === format);
}

/** Canonical MIME for a format, or `''` when unknown. */
export function mimeForFormat(format: CanonicalImageFormat): string {
  return MIME_BY_FORMAT[format];
}

/**
 * Normalise a MIME type: lowercase, strip any `; charset=…` parameter.
 * `image/jpg` (Android) and `image/x-ms-bmp` (Windows) are folded to canonical.
 */
export function normalizeMime(mime: string | undefined | null): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  const legacy: Record<string, string> = {
    'image/jpg': 'image/jpeg',
    'image/pjpeg': 'image/jpeg',
    'image/x-ms-bmp': 'image/bmp',
    'image/x-bmp': 'image/bmp',
    'image/x-png': 'image/png',
    'image/x-xbitmap': 'image/bmp',
    'image/x-icon': 'image/x-icon',
    'image/vnd.microsoft.icon': 'image/x-icon',
    'image/heif': 'image/heic',
    'image/heic-sequence': 'image/heic',
    'image/x-tiff': 'image/tiff',
    'image/x-webp': 'image/webp',
  };
  return legacy[base] || base;
}

const EXT_FROM_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'application/pdf': 'pdf',
};

export function extFromMime(mime: string): string {
  return EXT_FROM_MIME[normalizeMime(mime)] || '';
}

/** Resolve a MIME type to its canonical image family (`null` if not an image). */
export function canonicalFormatFromMime(mime: string): CanonicalImageFormat | null {
  const ext = extFromMime(mime);
  return ext ? canonicalImageFormat(ext) : null;
}

export function mimeFromExt(ext: string): string {
  const lowered = (ext || '').toLowerCase().trim();
  if (lowered === 'pdf') return 'application/pdf';
  const canonical = canonicalImageFormat(lowered);
  if (canonical) return MIME_BY_FORMAT[canonical];
  // Some callers pass a full MIME through; honour it when it already is one.
  if (lowered.includes('/')) return normalizeMime(lowered);
  return 'application/octet-stream';
}

export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

/**
 * Read the magic bytes of a file and return the canonical image family.
 * Returns `null` when the bytes match no known image signature.
 */
export function sniffFormatFromBytes(bytes: Uint8Array): CanonicalImageFormat | null {
  if (bytes.length < 4) return null;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return 'webp';
  // GIF: "GIF8"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif';
  // BMP: "BM"
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  // ICO / CUR: 00 00 then type (01 = icon, 02 = cursor) then count
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && (bytes[2] === 0x01 || bytes[2] === 0x02) && bytes[3] === 0x00)
    return 'ico';
  // TIFF: "II" (little-endian) or "MM" (big-endian) then the 42 (or 43 for BigTIFF)
  // magic number in the correct byte order. The old check compared byte 2 in both
  // orders, which never matched big-endian ("MM") files.
  if (bytes[0] === 0x49 && bytes[1] === 0x49 && (bytes[2] === 0x2a || bytes[2] === 0x2b)) return 'tiff';
  if (bytes[0] === 0x4d && bytes[1] === 0x4d && (bytes[3] === 0x2a || bytes[3] === 0x2b)) return 'tiff';
  // ISO-BMFF container (ftyp box at offset 4) → AVIF or HEIC/HEIF
  if (bytes.length >= 12) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
      if (brand.startsWith('avif') || brand.startsWith('avis')) return 'avif';
      // heic/heix/hevc/hevx are the common iPhone brands; mif1/msf1 are generic HEIF.
      if (
        brand.startsWith('heic') ||
        brand.startsWith('heix') ||
        brand.startsWith('hevc') ||
        brand.startsWith('hevx') ||
        brand === 'mif1' ||
        brand === 'msf1'
      )
        return 'heic';
    }
  }
  // SVG: optional BOM/whitespace, then an XML prolog, DOCTYPE, comment or the
  // <svg> element itself. Older builds only peeked at 3 bytes, so files that
  // began with `<?xml` plus a stylesheet or a comment were missed.
  let i = 0;
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  if (i < bytes.length && bytes[i] === 0x3c /* '<' */) {
    const head = String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 256))).toLowerCase();
    if (head.startsWith('<svg') || head.startsWith('<?xml') || head.startsWith('<!doctype svg') || head.startsWith('<!--'))
      return 'svg';
  }
  return null;
}

/**
 * Signatures that prove a file is NOT an image, used to stop a renamed
 * executable/script from being accepted on the strength of its extension.
 * Deliberately conservative: only unambiguous binary/executable headers.
 */
export function sniffNonImage(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // MZ — Windows PE executable
  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return 'exe';
  // ELF — Linux executable
  if (bytes[0] === 0x7f && bytes[1] === 0x45 && bytes[2] === 0x4c && bytes[3] === 0x46) return 'exe';
  // Mach-O
  if (
    (bytes[0] === 0xfe && bytes[1] === 0xed && bytes[2] === 0xfa) ||
    (bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe)
  )
    return 'exe';
  // Class file
  if (bytes[0] === 0xca && bytes[1] === 0xfe && bytes[2] === 0xba && bytes[3] === 0xbe) return 'exe';
  // Shell script shebang
  if (bytes[0] === 0x23 && bytes[1] === 0x21) return 'script';
  // PostScript
  if (bytes[0] === 0x25 && bytes[1] === 0x21 && bytes[2] === 0x50 && bytes[3] === 0x53) return 'postscript';
  return null;
}

export interface FileInspection {
  /** Canonical image family detected from the magic bytes, if any. */
  image: CanonicalImageFormat | null;
  /** Non-image signature detected, if any (e.g. `exe`). */
  nonImage: string | null;
  /** True when the read failed or the file was too small to inspect. */
  inconclusive: boolean;
}

/** How many leading bytes we inspect — enough for an SVG prolog plus a comment. */
const SNIFF_BYTES = 512;

export function inspectBytes(bytes: Uint8Array): FileInspection {
  if (bytes.length < 4) return { image: null, nonImage: null, inconclusive: true };
  return { image: sniffFormatFromBytes(bytes), nonImage: sniffNonImage(bytes), inconclusive: false };
}

export function sniffFormat(file: File): Promise<CanonicalImageFormat | null> {
  return inspectFile(file).then((r) => r.image);
}

/** Read the leading bytes of a file and classify them. */
export function inspectFile(file: File): Promise<FileInspection> {
  return new Promise((resolve) => {
    if (file.size < 4) return resolve({ image: null, nonImage: null, inconclusive: true });
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(inspectBytes(new Uint8Array(reader.result as ArrayBuffer)));
      } catch {
        resolve({ image: null, nonImage: null, inconclusive: true });
      }
    };
    // Never reject on a read error — validation stays lenient when we cannot see
    // the bytes, and the real decode step reports genuine corruption later.
    reader.onerror = () => resolve({ image: null, nonImage: null, inconclusive: true });
    reader.readAsArrayBuffer(file.slice(0, SNIFF_BYTES));
  });
}

export function supportsWebPEncode(): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    return c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    return false;
  }
}

export function supportsOffscreenCanvas(): boolean {
  return typeof OffscreenCanvas !== 'undefined';
}

/**
 * Map a detected source format onto one the canvas encoder can actually write.
 * HEIC/AVIF/TIFF/BMP come from cameras and scanners but have no canvas encoder,
 * so they land on JPG (opaque photos); SVG/ICO keep alpha via PNG.
 */
export function encodableFormat(format: CanonicalImageFormat | string | null): ImageFormat {
  switch (format) {
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
    case 'gif':
      return 'gif';
    case 'svg':
    case 'ico':
      return 'png';
    case 'jpg':
    case 'jpeg':
    case 'jfif':
    case 'heic':
    case 'avif':
    case 'tiff':
    case 'tif':
    case 'bmp':
      return 'jpg';
    default:
      return 'png';
  }
}

/** Load an image from a File into both an HTMLImageElement and (if available) an ImageBitmap. */
export function decodeImage(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      // Prefer the MIME type, then the filename extension, then a safe default.
      // The result is always a format the encoder understands, so a HEIC from an
      // iPhone still produces a downloadable JPG/PNG/WebP.
      const detected =
        canonicalFormatFromMime(file.type) ??
        canonicalImageFormat(fileExt(file.name)) ??
        'png';
      const format = encodableFormat(detected);
      const resolveWith = (bitmap: ImageBitmap | null) => {
        // After the image is fully decoded into the img element memory,
        // the object URL is no longer needed; revoking prevents memory leaks.
        // A brief delay ensures any immediate canvas draw operations finish.
        setTimeout(() => URL.revokeObjectURL(url), 100);
        resolve({ image: img, bitmap, width, height, format, file });
      };
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(file)
          .then((bitmap) => resolveWith(bitmap))
          .catch(() => resolveWith(null));
      } else {
        resolveWith(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode-failed'));
    };
    img.src = url;
  });
}

export interface EncodeOptions {
  format: ImageFormat;
  quality?: number; // 0..1 for jpeg/webp
}

/**
 * Encode a canvas/bitmap source to a Blob using the requested format.
 * Falls back to PNG when a format is unsupported.
 */
export function canvasToBlob(
  source: HTMLCanvasElement | OffscreenCanvas | ImageBitmap,
  opts: EncodeOptions,
): Promise<Blob> {
  const { format, quality = 0.92 } = opts;
  const mime = mimeFromExt(format);
  const isLossy = format === 'jpg' || format === 'jpeg' || format === 'webp';

  // Use OffscreenCanvas.convertToBlob when available (fast, worker-friendly).
  if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) {
    try {
      const off = source as OffscreenCanvas;
      if (isLossy) {
        return off.convertToBlob({ type: mime, quality }) as Promise<Blob>;
      }
      return off.convertToBlob({ type: mime }) as Promise<Blob>;
    } catch {
      /* fall through */
    }
  }
  if (source instanceof HTMLCanvasElement) {
    if (isLossy) {
      return new Promise((resolve, reject) => {
        source.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('encode-failed'))),
          mime,
          quality,
        );
      });
    }
    return new Promise((resolve, reject) => {
      source.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), mime);
    });
  }
  // ImageBitmap fallback: draw to a temp canvas.
  const c = document.createElement('canvas');
  c.width = (source as ImageBitmap).width;
  c.height = (source as ImageBitmap).height;
  const ctx = c.getContext('2d');
  if (!ctx) return Promise.reject(new Error('no-2d-context'));
  ctx.drawImage(source as ImageBitmap, 0, 0);
  return canvasToBlob(c, opts);
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revocation so the download can begin.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Copy text using the modern Clipboard API with a textarea fallback. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read-error'));
    reader.readAsDataURL(file);
  });
}
