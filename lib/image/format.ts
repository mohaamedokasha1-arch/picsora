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
 * Every spelling we know for the same underlying format.
 *
 * Mobile devices, messaging apps and download managers are wildly inconsistent
 * here: an iPhone photo can show up as `.heic`, `.heif` or a plain `.jpg` with
 * an `image/heic` MIME type, WhatsApp sends `.jfif`, Android file pickers often
 * report no extension at all. Anything that compares extensions must go through
 * `normalizeExt()` first so those variants collapse onto one canonical token.
 */
const EXT_ALIASES: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  jpe: 'jpg',
  jfif: 'jpg',
  jfi: 'jpg',
  jif: 'jpg',
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
  heic: 'heif',
  heics: 'heif',
  heif: 'heif',
  heifs: 'heif',
  hif: 'heif',
  svg: 'svg',
  ico: 'ico',
  cur: 'ico',
  pdf: 'pdf',
};

/** Canonical image/PDF formats we can recognise from magic bytes. */
export type SniffedFormat =
  | 'jpg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'bmp'
  | 'tiff'
  | 'avif'
  | 'heif'
  | 'svg'
  | 'ico'
  | 'pdf';

/** All image formats (canonical tokens) — used to decide "is this an image?". */
export const IMAGE_FORMATS: ReadonlySet<string> = new Set<string>([
  'jpg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'avif',
  'heif',
  'svg',
  'ico',
]);

/**
 * Collapse an extension/MIME-derived token onto its canonical spelling.
 * Returns `''` for empty input and passes unknown tokens through unchanged
 * (lower-cased) so callers can still compare them.
 */
export function normalizeExt(ext?: string | null): string {
  if (!ext) return '';
  const clean = ext.trim().toLowerCase().replace(/^\.+/, '');
  if (!clean) return '';
  return EXT_ALIASES[clean] ?? clean;
}

/** True when the canonical token describes a raster/vector image (not a PDF). */
export function isImageFormat(ext?: string | null): boolean {
  return IMAGE_FORMATS.has(normalizeExt(ext));
}

/** Every known spelling of a format, e.g. `jpg` → `['jpg','jpeg','jpe','jfif',…]`. */
export function extAliasList(ext: string): string[] {
  const canonical = normalizeExt(ext);
  if (!canonical) return [];
  return Object.keys(EXT_ALIASES).filter((key) => EXT_ALIASES[key] === canonical);
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/jfif': 'jpg',
  'image/png': 'png',
  'image/x-png': 'png',
  'image/vnd.mozilla.apng': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/x-ms-bmp': 'bmp',
  'image/x-bmp': 'bmp',
  'image/tiff': 'tiff',
  'image/tif': 'tiff',
  'image/x-tiff': 'tiff',
  'image/avif': 'avif',
  'image/avif-sequence': 'avif',
  'image/heic': 'heif',
  'image/heic-sequence': 'heif',
  'image/heif': 'heif',
  'image/heif-sequence': 'heif',
  'image/x-heic': 'heif',
  'image/x-heif': 'heif',
  'image/svg+xml': 'svg',
  'image/svg': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/ico': 'ico',
  'application/pdf': 'pdf',
  'application/x-pdf': 'pdf',
};

/** True when the browser/OS claims this is some kind of image. */
export function isImageMime(mime?: string | null): boolean {
  return !!mime && /^image\//i.test(mime.trim());
}

/**
 * Strip any codec parameters (`image/jpeg; charset=…`) some Android pickers add
 * and lower-case the result, so comparisons never fail on formatting noise.
 */
export function normalizeMime(mime?: string | null): string {
  if (!mime) return '';
  return mime.split(';')[0].trim().toLowerCase();
}

export function extFromMime(mime: string): string {
  const clean = normalizeMime(mime);
  return MIME_TO_EXT[clean] || '';
}

export function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    avif: 'image/avif',
    heif: 'image/heif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    pdf: 'application/pdf',
  };
  return map[normalizeExt(ext)] || 'application/octet-stream';
}

/**
 * Formats the browser is realistically able to decode into a canvas.
 * HEIC/HEIF only decodes on Apple platforms, so it is *not* listed here —
 * callers use it to pick a safe fallback output format.
 */
const CANVAS_SAFE_FORMATS: ReadonlySet<string> = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

/**
 * Coerce a detected input format onto a value that is safe to use as an
 * *output* format. iPhone HEIC photos, TIFF scans, BMPs and AVIF files all get
 * a sensible default instead of leaking an unusable token into the encoders.
 */
export function toImageFormat(candidate?: string | null): ImageFormat {
  const clean = (candidate || '').trim().toLowerCase();
  if (CANVAS_SAFE_FORMATS.has(clean)) return clean as ImageFormat;
  const canonical = normalizeExt(clean);
  if (canonical === 'jpg') return 'jpg';
  // Vector/icon sources usually carry transparency → lossless raster output.
  if (canonical === 'svg' || canonical === 'ico') return 'png';
  // HEIC/HEIF/AVIF/TIFF/BMP are photographs in the overwhelming majority of cases.
  return 'jpg';
}

export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

/**
 * Read the magic bytes of a file and report the *actual* format.
 *
 * This is used as positive evidence ("this really is a PNG") and never as the
 * only reason to reject an upload: filenames and MIME types from mobile devices
 * disagree with the real content all the time (a screenshot shared from
 * WhatsApp may be `.jpg` on disk but PNG inside), and rejecting those is what
 * produced the bogus "unsupported file type" errors.
 */
export function sniffFormatFromBytes(bytes: Uint8Array): SniffedFormat | null {
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
  ) {
    return 'webp';
  }
  // GIF: "GIF8"
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'gif';
  // BMP: "BM"
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  // TIFF: "II" (little-endian) or "MM" (big-endian) followed by 42/43
  if (bytes.length >= 4 && ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d))) {
    if (bytes[2] === 0x2a || bytes[2] === 0x43 || bytes[3] === 0x2a || bytes[3] === 0x43) return 'tiff';
  }
  // ISO base media (MP4 family): AVIF, HEIC/HEIF — and MP4 videos we must reject.
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
    if (brand.startsWith('avif') || brand.startsWith('avis')) return 'avif';
    if (/^(heic|heix|hevc|hevx|heim|heis|heif|mif1|msf1)/.test(brand)) return 'heif';
  }
  // ICO / CUR: 00 00 01 00 (or 02 00 for cursors)
  if (bytes[0] === 0x00 && bytes[1] === 0x00 && (bytes[2] === 0x01 || bytes[2] === 0x02) && bytes[3] === 0x00) {
    return 'ico';
  }
  // PDF: "%PDF"
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  // SVG: optional whitespace/BOM then <svg or <?xml
  let i = 0;
  // UTF-8 BOM
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
  if (i + 4 < bytes.length) {
    const snippet = String.fromCharCode(...bytes.subarray(i, i + 5)).toLowerCase();
    if (snippet.startsWith('<svg') || snippet.startsWith('<?xml')) return 'svg';
  }
  return null;
}

/** How many leading bytes we inspect — enough for every container above. */
const SNIFF_BYTES = 32;

export function sniffFormat(file: File): Promise<SniffedFormat | null> {
  return new Promise((resolve) => {
    if (!file || file.size < 4) return resolve(null);
    // Some pickers hand us a Blob without `slice` semantics we can trust; guard.
    if (typeof file.slice !== 'function') return resolve(null);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          resolve(sniffFormatFromBytes(new Uint8Array(reader.result as ArrayBuffer)));
        } catch {
          resolve(null);
        }
      };
      reader.onerror = () => resolve(null);
      reader.onabort = () => resolve(null);
      reader.readAsArrayBuffer(file.slice(0, Math.min(SNIFF_BYTES, file.size)));
    } catch {
      resolve(null);
    }
  });
}

/**
 * True when the file's leading bytes contain the `%PDF` signature.
 *
 * Mobile/cloud pickers frequently deliver PDFs with no extension, an empty MIME
 * type or `application/octet-stream`, and a few producers prepend junk before
 * the header — so we scan a short window instead of demanding byte 0.
 */
export function looksLikePdf(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    if (!file || file.size < 4 || typeof file.slice !== 'function') return resolve(false);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const bytes = new Uint8Array(reader.result as ArrayBuffer);
          let text = '';
          for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
          resolve(text.includes('%PDF'));
        } catch {
          resolve(false);
        }
      };
      reader.onerror = () => resolve(false);
      reader.onabort = () => resolve(false);
      reader.readAsArrayBuffer(file.slice(0, Math.min(1024, file.size)));
    } catch {
      resolve(false);
    }
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

/** Load an image from a File into both an HTMLImageElement and (if available) an ImageBitmap. */
export async function decodeImage(file: File): Promise<DecodedImage> {
  // Sniff the real container first so the reported output format survives
  // mislabelled files from phones (HEIC renamed .jpg, PNG renamed .jpg, …).
  const sniffed = await sniffFormat(file).catch(() => null);
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      // Prefer the real bytes over labels: phones routinely mislabel files
      // (`.jpg` that is really PNG, HEIC with an empty MIME type, …).
      const format = toImageFormat(sniffed ?? extFromMime(file.type) ?? fileExt(file.name));
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
