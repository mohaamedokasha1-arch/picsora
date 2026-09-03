import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { canvasToBlob, decodeImage, mimeFromExt, stripExtension } from '@/lib/image/format';

export interface CanvasBox {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

export function createCanvas(width: number, height: number): CanvasBox {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  return { canvas, ctx };
}

export type DrawSource = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

/** Draw a source onto a fresh canvas at natural size (or optionally scaled). */
export function drawToCanvas(
  src: DrawSource,
  width?: number,
  height?: number,
): CanvasBox {
  const sw = width ?? (src as HTMLImageElement).naturalWidth ?? (src as ImageBitmap).width;
  const sh = height ?? (src as HTMLImageElement).naturalHeight ?? (src as ImageBitmap).height;
  const { canvas, ctx } = createCanvas(sw, sh);
  ctx.drawImage(src as CanvasImageSource, 0, 0, sw, sh);
  return { canvas, ctx };
}

export function sourceOf(decoded: DecodedImage): DrawSource {
  return decoded.bitmap ?? decoded.image;
}

/** Draw a decoded image to a canvas, optionally scaling to target size. */
export function canvasFromDecoded(decoded: DecodedImage, width?: number, height?: number): CanvasBox {
  return drawToCanvas(sourceOf(decoded), width, height);
}

export async function loadDecoded(file: File): Promise<DecodedImage> {
  return decodeImage(file);
}

export async function encodeDecodedToBlob(
  decoded: DecodedImage,
  format: ImageFormat,
  quality = 0.92,
): Promise<Blob> {
  if (decoded.bitmap) {
    // Encode directly from the bitmap via an OffscreenCanvas fast path.
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const off = new OffscreenCanvas(decoded.width, decoded.height);
        const octx = off.getContext('2d');
        if (octx) {
          octx.drawImage(decoded.bitmap, 0, 0);
          return canvasToBlob(off, { format, quality });
        }
      } catch {
        /* fall through */
      }
    }
    const { canvas } = drawToCanvas(decoded.bitmap);
    return canvasToBlob(canvas, { format, quality });
  }
  const { canvas } = drawToCanvas(decoded.image);
  return canvasToBlob(canvas, { format, quality });
}

export function makeResult(blob: Blob, format: ImageFormat, name: string): ProcessResult {
  return { blob, format, name };
}

export function nameOf(file: File): string {
  return stripExtension(file.name);
}

export function outputName(base: string, format: ImageFormat): string {
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${base}.${ext}`;
}

export function mimeOf(format: ImageFormat): string {
  return mimeFromExt(format);
}

/** Fill a canvas with a CSS color string. */
export function fillBackground(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function rgbToHex(r: number, g: number, b: number): string {
  const to = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`.toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}
