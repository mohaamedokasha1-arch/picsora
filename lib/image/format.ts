/**
 * Browser feature detection + format helpers.
 * Everything here is client-side only.
 */

import type { DecodedImage, ImageFormat } from '@/lib/types';
import { getExifOrientation, applyOrientationToCanvas, detectLivePhoto } from '@/lib/image/exif';

export const MAX_DIMENSION = 12000; // safety cap for image dimensions (12000x12000)
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB safety limit

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
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/heic-sequence': 'heic',
    'image/heif-sequence': 'heif',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
  };
  return map[mime.toLowerCase()] || '';
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
    heic: 'image/heic',
    heif: 'image/heif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
  };
  return map[ext.toLowerCase()] || 'application/octet-stream';
}

export function stripExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(0, idx) : name;
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[\\/*?:"<>|\x00-\x1F]/g, '_')
    .replace(/\.{2,}/g, '.')
    .trim() || 'image';
}

export function isHeicFile(file: File | Blob, ext?: string): boolean {
  const extension = (ext || (file instanceof File ? fileExt(file.name) : '')).toLowerCase();
  if (extension === 'heic' || extension === 'heif') return true;
  if (file.type === 'image/heic' || file.type === 'image/heif' || file.type === 'image/heic-sequence' || file.type === 'image/heif-sequence') {
    return true;
  }
  return false;
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
    bytes.length >= 12 &&
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
  // PDF: %PDF
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  // HEIC / HEIF / AVIF: ftyp box
  if (bytes.length >= 12) {
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(...bytes.subarray(8, 12)).toLowerCase();
      if (brand.includes('heic') || brand.includes('heix') || brand.includes('hevc') || brand.includes('heim') || brand.includes('heis') || brand.includes('mif1') || brand.includes('msf1')) {
        return 'heic';
      }
      if (brand.includes('avif') || brand.includes('avis')) return 'avif';
    }
  }
  // SVG: starts with optional whitespace then <svg or <?xml
  if (bytes.length >= 4) {
    let i = 0;
    while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x09 || bytes[i] === 0x0a || bytes[i] === 0x0d)) i++;
    if (i + 3 < bytes.length) {
      const snippet = String.fromCharCode(...bytes.subarray(i, i + 3)).toLowerCase();
      if (snippet === '<sv' || snippet === '<?x') return 'svg';
    }
  }
  return null;
}

export function sniffFormat(file: File | Blob): Promise<string | null> {
  return new Promise((resolve) => {
    if (file.size < 4) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer);
      resolve(sniffFormatFromBytes(arr));
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file.slice(0, 32));
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
 * Convert a HEIC / HEIF file to a standard JPEG blob in the browser.
 * Dynamically loads heic2any on-demand for code splitting.
 */
export async function convertHeicToBlob(file: File | Blob): Promise<Blob> {
  if (typeof window === 'undefined') {
    throw new Error('heic-unsupported');
  }
  try {
    const heic2anyModule = await import('heic2any');
    const heic2any = heic2anyModule.default || heic2anyModule;
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.95,
    });
    if (Array.isArray(result)) {
      return result[0];
    }
    return result as Blob;
  } catch (err) {
    console.error('HEIC conversion failed:', err);
    throw new Error('heic-conversion-failed');
  }
}

/**
 * Load an image from a File into an HTMLImageElement and ImageBitmap.
 * Handles EXIF orientation correction and HEIC conversion transparently.
 */
export async function decodeImage(file: File): Promise<DecodedImage> {
  // Safety checks
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('file-too-large');
  }

  const ext = fileExt(file.name);
  let processFile: File | Blob = file;
  let detectedOrientation = 1;

  // Extract EXIF orientation before any conversion
  try {
    detectedOrientation = await getExifOrientation(file);
  } catch {
    detectedOrientation = 1;
  }

  // Detect Live Photo
  let isLivePhoto = false;
  try {
    const liveInfo = await detectLivePhoto(file);
    isLivePhoto = liveInfo.isLivePhoto;
  } catch {
    isLivePhoto = false;
  }

  // Check if HEIC
  if (isHeicFile(file, ext)) {
    try {
      processFile = await convertHeicToBlob(file);
    } catch {
      throw new Error('heic-conversion-failed');
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(processFile);
    const rawImg = new Image();
    rawImg.decoding = 'async';

    rawImg.onload = async () => {
      let finalWidth = rawImg.naturalWidth;
      let finalHeight = rawImg.naturalHeight;

      if (finalWidth > MAX_DIMENSION || finalHeight > MAX_DIMENSION) {
        URL.revokeObjectURL(url);
        return reject(new Error('dimensions-too-large'));
      }

      const format = (extFromMime(file.type) as ImageFormat) || (ext as ImageFormat) || 'jpg';

      // If EXIF orientation is rotated (2-8), render to an upright canvas and create an upright Image
      if (detectedOrientation > 1) {
        try {
          const swap = detectedOrientation >= 5 && detectedOrientation <= 8;
          finalWidth = swap ? rawImg.naturalHeight : rawImg.naturalWidth;
          finalHeight = swap ? rawImg.naturalWidth : rawImg.naturalHeight;

          const canvas = document.createElement('canvas');
          applyOrientationToCanvas(canvas, rawImg, detectedOrientation, rawImg.naturalWidth, rawImg.naturalHeight);

          // Create upright image from oriented canvas
          const orientedImg = new Image();
          orientedImg.onload = () => {
            URL.revokeObjectURL(url);
            let bitmap: ImageBitmap | null = null;
            if (typeof createImageBitmap === 'function') {
              createImageBitmap(canvas)
                .then((bm) => {
                  resolve({
                    image: orientedImg,
                    bitmap: bm,
                    width: finalWidth,
                    height: finalHeight,
                    format,
                    file,
                    orientation: detectedOrientation,
                    isLivePhoto,
                  });
                })
                .catch(() => {
                  resolve({
                    image: orientedImg,
                    bitmap: null,
                    width: finalWidth,
                    height: finalHeight,
                    format,
                    file,
                    orientation: detectedOrientation,
                    isLivePhoto,
                  });
                });
            } else {
              resolve({
                image: orientedImg,
                bitmap,
                width: finalWidth,
                height: finalHeight,
                format,
                file,
                orientation: detectedOrientation,
                isLivePhoto,
              });
            }
          };
          orientedImg.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('decode-failed'));
          };
          orientedImg.src = canvas.toDataURL('image/png');
          return;
        } catch {
          /* fall back to direct image */
        }
      }

      // Standard orientation = 1
      URL.revokeObjectURL(url);
      if (typeof createImageBitmap === 'function') {
        createImageBitmap(processFile)
          .then((bm) => {
            resolve({
              image: rawImg,
              bitmap: bm,
              width: finalWidth,
              height: finalHeight,
              format,
              file,
              orientation: 1,
              isLivePhoto,
            });
          })
          .catch(() => {
            resolve({
              image: rawImg,
              bitmap: null,
              width: finalWidth,
              height: finalHeight,
              format,
              file,
              orientation: 1,
              isLivePhoto,
            });
          });
      } else {
        resolve({
          image: rawImg,
          bitmap: null,
          width: finalWidth,
          height: finalHeight,
          format,
          file,
          orientation: 1,
          isLivePhoto,
        });
      }
    };

    rawImg.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode-failed'));
    };

    rawImg.src = url;
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
  const effectiveFormat = format === 'heic' || format === 'heif' ? 'jpg' : format;
  const mime = mimeFromExt(effectiveFormat);
  const isLossy = effectiveFormat === 'jpg' || effectiveFormat === 'jpeg' || effectiveFormat === 'webp';

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
  a.download = sanitizeFilename(filename);
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
