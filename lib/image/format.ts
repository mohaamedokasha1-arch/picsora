/**
 * Browser feature detection + format helpers.
 * Everything here is client-side only.
 */

import type { DecodedImage, ImageFormat } from '@/lib/types';

export const MAX_DIMENSION = 16000; // safety cap for canvas dimensions

/**
 * Canonical format identifiers used across the app.
 *
 * Everything the sniffers and the validator return is one of these, so callers
 * never have to deal with the dozens of real-world spellings (.jpeg, .jfif,
 * .tif, .heic, ...).
 */
export type CanonicalFormat = 'jpg' | 'png' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'avif' | 'heif' | 'svg' | 'pdf';

/**
 * Every extension we accept, mapped to its canonical format.
 *
 * Mobile cameras, messengers (WhatsApp `.jfif`), download managers and desktop
 * OSes use many non-standard spellings. Rejecting those is the single biggest
 * source of bogus "this file type is not supported" errors, so they are all
 * folded onto the canonical format the encoders understand.
 */
const EXT_ALIASES: Record<string, CanonicalFormat> = {
  // JPEG family
  jpg: 'jpg',
  jpeg: 'jpg',
  jpe: 'jpg',
  jfif: 'jpg',
  jfi: 'jpg',
  jif: 'jpg',
  pjpeg: 'jpg',
  pjp: 'jpg',
  // PNG family
  png: 'png',
  apng: 'png',
  // WebP / GIF
  webp: 'webp',
  gif: 'gif',
  // Bitmap
  bmp: 'bmp',
  dib: 'bmp',
  // TIFF
  tiff: 'tiff',
  tif: 'tiff',
  // Modern phone formats
  avif: 'avif',
  heic: 'heif',
  heics: 'heif',
  heif: 'heif',
  heifs: 'heif',
  // Vector
  svg: 'svg',
  svgz: 'svg',
  // Document
  pdf: 'pdf',
};

/** MIME types reported by browsers/OSes, mapped to the canonical format. */
const MIME_TO_FORMAT: Record<string, CanonicalFormat> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg', // non-standard but reported by some Android builds
  'image/pjpeg': 'jpg',
  'image/x-jpeg': 'jpg',
  'image/png': 'png',
  'image/x-png': 'png',
  'image/apng': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/x-windows-bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/x-tiff': 'tiff',
  'image/avif': 'avif',
  'image/avif-sequence': 'avif',
  'image/heic': 'heif',
  'image/heic-sequence': 'heif',
  'image/heif': 'heif',
  'image/heif-sequence': 'heif',
  'image/svg+xml': 'svg',
  'image/svg': 'svg',
  'application/pdf': 'pdf',
  'application/x-pdf': 'pdf',
};

/** Strip and normalize a filename extension. Returns '' when there is none. */
export function fileExt(name: string): string {
  const clean = (name || '').trim();
  const idx = clean.lastIndexOf('.');
  // A name with no dot (very common for mobile camera captures, e.g.
  // "IMG_20260904_120000" or "blob") has no extension at all.
  if (idx < 0 || idx === clean.length - 1) return '';
  return clean.slice(idx + 1).toLowerCase();
}

/** Normalize any extension spelling to its canonical format ('' when unknown). */
export function canonicalFormatFromExt(ext: string): CanonicalFormat | '' {
  return EXT_ALIASES[(ext || '').trim().toLowerCase()] ?? '';
}

/** Normalize any MIME type to its canonical format ('' when unknown). */
export function canonicalFormatFromMime(mime: string): CanonicalFormat | '' {
  const clean = (mime || '').trim().toLowerCase();
  if (!clean) return '';
  // Drop any parameters, e.g. "image/svg+xml; charset=utf-8".
  const base = clean.split(';')[0].trim();
  return MIME_TO_FORMAT[base] ?? '';
}

/** True when the extension is any kind of image (not PDF, not unknown). */
export function isImageExt(ext: string): boolean {
  const c = canonicalFormatFromExt(ext);
  return c !== '' && c !== 'pdf';
}

/** True when the MIME type is any kind of image. */
export function isImageMime(mime: string): boolean {
  const base = (mime || '').trim().toLowerCase().split(';')[0].trim();
  return base.startsWith('image/');
}

/** Canonical extension for a MIME type ('' when unknown). */
export function extFromMime(mime: string): string {
  return canonicalFormatFromMime(mime);
}

export function mimeFromExt(ext: string): string {
  const canonical = canonicalFormatFromExt(ext);
  const map: Record<CanonicalFormat, string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    avif: 'image/avif',
    heif: 'image/heic',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
  };
  return canonical ? map[canonical] : 'application/octet-stream';
}

/**
 * All accepted spellings for a canonical format, for building `accept` attrs.
 * Listing extensions next to MIME types matters on Android, where several file
 * managers only match one or the other and otherwise grey out real photos.
 */
export function extensionsForFormat(format: CanonicalFormat): string[] {
  return Object.keys(EXT_ALIASES).filter((e) => EXT_ALIASES[e] === format);
}

export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

/**
 * Read the magic bytes of a file and return its real, canonical format.
 *
 * This is the ground truth the validator falls back on: mobile pickers hand us
 * files with no name, no extension and sometimes no MIME type, so the bytes are
 * the only reliable signal. Returns null when the format is not recognized.
 */
export function sniffFormatFromBytes(bytes: Uint8Array): CanonicalFormat | null {
  if (bytes.length < 4) return null;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  )
    return 'webp';
  // GIF: "GIF8"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif';
  // BMP: "BM"
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  // PDF: "%PDF" — caught so a PDF renamed to .jpg is rejected accurately.
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  // TIFF: "II" (little-endian) or "MM" (big-endian) followed by 42/43
  if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d)) {
    if (bytes[2] === 0x2a || bytes[2] === 0x43) return 'tiff';
  }
  // ISO-BMFF container (AVIF / HEIC): "ftyp" box at offset 4, brand at 8..11.
  if (bytes.length >= 12) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
      if (brand.startsWith('avi')) return 'avif';
      if (brand.startsWith('hei') || brand.startsWith('hev')) return 'heif';
      // "mif1"/"msf1" are shared by both families; AVIF is far more common on
      // the web, so that is the safer guess.
      if (brand === 'mif1' || brand === 'msf1') return 'avif';
    }
  }
  // SVG: optional BOM/whitespace, then <svg, <?xml or <!DOCTYPE svg
  let i = 0;
  // Skip a UTF-8 BOM.
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  if (i + 3 <= bytes.length) {
    const snippet = String.fromCharCode(...bytes.subarray(i, i + 3));
    if (snippet === '<sv' || snippet === '<?x' || snippet === '<!D' || snippet === '<!d') return 'svg';
  }
  return null;
}

export function sniffFormat(file: File): Promise<CanonicalFormat | null> {
  return new Promise((resolve) => {
    if (file.size < 4) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer);
      resolve(sniffFormatFromBytes(arr));
    };
    reader.onerror = () => resolve(null);
    // 64 bytes: enough for every signature above including an SVG prologue.
    reader.readAsArrayBuffer(file.slice(0, 64));
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
 * Best-effort detection of what a file really is, in priority order:
 * MIME type → filename extension → magic bytes.
 *
 * The magic-byte fallback is what makes mobile uploads work: camera captures
 * and content-URI files frequently arrive with no usable name and an empty or
 * generic MIME type.
 */
export async function detectFormat(file: File): Promise<CanonicalFormat | ''> {
  const fromMime = canonicalFormatFromMime(file.type);
  if (fromMime) return fromMime;
  const fromExt = canonicalFormatFromExt(fileExt(file.name));
  if (fromExt) return fromExt;
  return (await sniffFormat(file)) || '';
}

/**
 * Map a detected format onto one the canvas pipeline can actually encode.
 *
 * `DecodedImage.format` is reused as the default *output* format by the
 * processors, so it must stay a valid `ImageFormat`. Opaque photo formats fall
 * back to JPG (small files), alpha-capable ones to PNG (no black boxes).
 */
export function toEncodableFormat(format: CanonicalFormat | ''): ImageFormat {
  switch (format) {
    case 'jpg':
      return 'jpg';
    case 'png':
      return 'png';
    case 'webp':
      return 'webp';
    case 'gif':
      return 'gif';
    case 'bmp':
    case 'heif':
      return 'jpg';
    default:
      return 'png';
  }
}

/** Load an image from a File into both an HTMLImageElement and (if available) an ImageBitmap. */
export async function decodeImage(file: File): Promise<DecodedImage> {
  const format = toEncodableFormat(await detectFormat(file));
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
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
