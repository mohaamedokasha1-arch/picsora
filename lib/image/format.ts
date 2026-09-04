/**
 * Browser feature detection + format helpers.
 * Everything here is client-side only.
 */

import type { DecodedImage, ImageFormat } from '@/lib/types';
import { convertHeicToBlob, isHeicFile } from '@/lib/image/heic';
import { safeDownloadFilename } from '@/lib/security/sanitize';

export const MAX_DIMENSION = 16000; // safety cap for canvas dimensions
/** Safety cap for total pixels (~100 MP) so giant panoramas fail with a clear message. */
export const MAX_PIXELS = 100_000_000;

/** Throw `image-too-large` when dimensions exceed what browsers can safely canvas. */
export function assertDecodableSize(width: number, height: number, fileName?: string): void {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('decode-failed');
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION || width * height > MAX_PIXELS) {
    const err = new Error('image-too-large') as Error & {
      params?: Record<string, string | number>;
    };
    err.params = {
      w: Math.round(width).toLocaleString('en-US'),
      h: Math.round(height).toLocaleString('en-US'),
      file: fileName ?? '',
    };
    throw err;
  }
}

export function fileExt(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
    'image/tif': 'tiff',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/heic-sequence': 'heic',
    'image/heif-sequence': 'heif',
    'application/pdf': 'pdf',
  };
  return map[(mime || '').toLowerCase()] || '';
}

export function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    heic: 'image/heic',
    heif: 'image/heif',
    pdf: 'application/pdf',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

/** Map an input format to one the browser canvas can actually encode. */
export function encodableFormat(format: ImageFormat): ImageFormat {
  if (format === 'heic' || format === 'heif') return 'jpg';
  if (format === 'gif') return 'png';
  return format;
}

/** Read the magic bytes of a file and verify they match the claimed extension. */
export function sniffFormatFromBytes(bytes: Uint8Array): string | null {
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
  // TIFF: "II" (little-endian) or "MM" (big-endian) followed by 42/43
  if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4d && bytes[1] === 0x4d)) {
    if (bytes[2] === 0x2a || bytes[2] === 0x43) return 'tiff';
  }
  // HEIF/AVIF family: `ftyp` box at offset 4, brand at offset 8.
  // HEIC brands: heic, heix, hevc, hevx, heim, heis, hevm, hevs, mif1, msf1, heci…
  if (bytes.length >= 12) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
      if (brand.startsWith('avif') || brand === 'avis') return 'avif';
      if (
        brand.startsWith('heic') ||
        brand.startsWith('heix') ||
        brand.startsWith('hevc') ||
        brand.startsWith('hevx') ||
        brand.startsWith('heim') ||
        brand.startsWith('heis') ||
        brand.startsWith('hevm') ||
        brand.startsWith('hevs') ||
        brand.startsWith('heci') ||
        brand === 'mif1' ||
        brand === 'msf1'
      )
        return 'heic';
    }
  }
  // SVG: starts with optional whitespace then <svg or <?xml
  if (bytes.length >= 4) {
    let i = 0;
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
    if (i + 3 < bytes.length) {
      const snippet = String.fromCharCode(...bytes.subarray(i, i + 3));
      if (snippet === '<sv' || snippet === '<?x') return 'svg';
    }
  }
  return null;
}

export function sniffFormat(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.size < 4) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer);
      resolve(sniffFormatFromBytes(arr));
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file.slice(0, 16));
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
 * Load an image from a File into both an HTMLImageElement and (if available)
 * an EXIF-aware ImageBitmap.
 *
 * - HEIC / HEIF photos (iPhone) are converted locally with heic2any first,
 *   because most browsers cannot decode them natively.
 * - `imageOrientation: 'from-image'` guarantees portrait photos never come
 *   out rotated or sideways after processing.
 * - Oversized images fail fast with `image-too-large` instead of crashing tab.
 */
export async function decodeImage(file: File): Promise<DecodedImage> {
  // Step 1 — HEIC/HEIF: convert locally to a decodable format first.
  let workFile: File = file;
  let heicConverted = false;
  if (isHeicFile(file)) {
    try {
      const blob = await convertHeicToBlob(file, 'image/jpeg', 0.92);
      workFile = new File([blob], file.name, { type: 'image/jpeg' });
      heicConverted = true;
    } catch {
      throw new Error('heic-convert-failed');
    }
  }

  const format =
    (extFromMime(file.type) as ImageFormat) || (fileExt(file.name) as ImageFormat) || 'png';

  // Step 2 — decode via <img> (universal fallback, keeps EXIF for display).
  const url = URL.createObjectURL(workFile);
  let img: HTMLImageElement;
  try {
    img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode-failed'));
      el.src = url;
    });
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof Error ? error : new Error('decode-failed');
  }

  // Step 3 — EXIF-aware bitmap so canvas pipelines keep the true orientation.
  let bitmap: ImageBitmap | null = null;
  if (typeof createImageBitmap === 'function') {
    try {
      bitmap = await createImageBitmap(workFile, { imageOrientation: 'from-image' });
    } catch {
      try {
        bitmap = await createImageBitmap(img);
      } catch {
        bitmap = null;
      }
    }
  }

  const width = bitmap?.width ?? img.naturalWidth;
  const height = bitmap?.height ?? img.naturalHeight;

  try {
    assertDecodableSize(width, height, file.name);
  } catch (error) {
    bitmap?.close?.();
    URL.revokeObjectURL(url);
    throw error;
  }

  // The object URL is no longer needed once pixels live in memory; a brief
  // delay ensures any immediate canvas draw operations finish first.
  setTimeout(() => URL.revokeObjectURL(url), 100);
  void heicConverted;
  return { image: img, bitmap, width, height, format, file };
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
  const { quality = 0.92 } = opts;
  // Safety net: never attempt to encode HEIC/GIF via canvas (toBlob yields null).
  const format = encodableFormat(opts.format);
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

/**
 * Start a client-side download for a Blob.
 *
 * The file name is always run through `safeDownloadFilename`, which strips
 * path separators/traversal, control characters and right-to-left override
 * spoofing (e.g. `invoice\u202Efdp.exe`) before it reaches the platform.
 * Human-readable names — including Arabic ones — are preserved as-is.
 */
export function triggerDownload(blob: Blob, filename: string) {
  const safeName = safeDownloadFilename(filename, 'download');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = safeName;
  a.rel = 'noopener noreferrer';
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
