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

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mime] || '';
}

export function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
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

/** Load an image from a File into both an HTMLImageElement and (if available) an ImageBitmap. */
export function decodeImage(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const format =
        (extFromMime(file.type) as ImageFormat) || (fileExt(file.name) as ImageFormat) || 'png';
      const resolveWith = (bitmap: ImageBitmap | null) => {
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
