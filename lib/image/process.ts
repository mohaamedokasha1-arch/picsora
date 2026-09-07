import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import {
  decodeImage,
  encodeCanvas,
  mimeFromExt,
  stripExtension,
  type EncodeOutcome,
} from '@/lib/image/format';
import { resolveEncodeFormat } from '@/lib/image/format-support';

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

export interface EncodeBlobOptions {
  /**
   * CSS colour painted under the image before encoding. Required when an
   * image with transparency is encoded to JPEG — canvas alpha otherwise
   * collapses to BLACK in the JPEG output.
   */
  background?: string;
}

export async function encodeDecodedToBlob(
  decoded: DecodedImage,
  format: ImageFormat,
  quality = 0.92,
  opts: EncodeBlobOptions = {},
): Promise<Blob> {
  const { blob } = await encodeDecodedResolved(decoded, format, quality, opts);
  return blob;
}

/**
 * Same pipeline as {@link encodeDecodedToBlob}, but it also reports the
 * container that was really written. Processors use the reported format for the
 * output name/MIME, so a browser without a WebP encoder produces a valid
 * `foo.png` (plus a `fallbackFrom: 'webp'` note for the UI) instead of either
 * crashing the tool or shipping PNG bytes named `.webp`.
 */
export async function encodeDecodedResolved(
  decoded: DecodedImage,
  format: ImageFormat,
  quality = 0.92,
  opts: EncodeBlobOptions = {},
): Promise<EncodeOutcome> {
  // Resolve the container up front: the OffscreenCanvas fast path below must
  // ask for the MIME the browser can actually satisfy.
  const target = resolveEncodeFormat(format).format;

  if (decoded.bitmap) {
    // Encode directly from the bitmap via an OffscreenCanvas fast path.
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        const off = new OffscreenCanvas(decoded.width, decoded.height);
        const octx = off.getContext('2d');
        if (octx) {
          if (opts.background) {
            octx.fillStyle = opts.background;
            octx.fillRect(0, 0, decoded.width, decoded.height);
          }
          octx.drawImage(decoded.bitmap, 0, 0);
          return finishEncode(await encodeCanvas(off, { format: target, quality }), format);
        }
      } catch {
        /* fall through to the 2D-canvas path */
      }
    }
    const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
    if (opts.background) fillBackground(ctx, opts.background, canvas.width, canvas.height);
    ctx.drawImage(decoded.bitmap, 0, 0);
    return finishEncode(await encodeCanvas(canvas, { format: target, quality }), format);
  }
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  if (opts.background) fillBackground(ctx, opts.background, canvas.width, canvas.height);
  ctx.drawImage(decoded.image, 0, 0);
  return finishEncode(await encodeCanvas(canvas, { format: target, quality }), format);
}

/** Attribute a container switch to the format the CALLER asked for. */
function finishEncode(outcome: EncodeOutcome, requested: ImageFormat): EncodeOutcome {
  return { ...outcome, fallbackFrom: outcome.format === requested ? undefined : requested };
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

/**
 * Read a canvas' pixel buffer, converting an engine-level failure into a
 * labelled error the UI can explain.
 *
 * Reading full-resolution pixels is the one step in the per-pixel tools
 * (grayscale, background remover, signature maker) that can legitimately fail
 * on a low-memory device with a large photo — the browser throws
 * `IndexSizeError`/`NotFoundError` rather than returning anything useful. Left
 * unguarded that surfaced as the generic "Something went wrong" panel with no
 * hint of what to do about it, so it is turned into `pixels-unavailable`, which
 * carries the offending file name for the message.
 */
export function readPixelsSafely(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  fileName?: string,
): ImageData {
  try {
    const data = ctx.getImageData(0, 0, Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    if (!data || !data.data || data.data.length === 0) throw new Error('empty pixel buffer');
    return data;
  } catch (error) {
    const err = new Error('pixels-unavailable') as Error & {
      params?: Record<string, string | number>;
      cause?: unknown;
    };
    err.params = { file: fileName ?? '' };
    err.cause = error;
    throw err;
  }
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
