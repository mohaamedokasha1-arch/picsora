/**
 * Processors for the effect tools: Image Blur, Image Pixelate, Brightness &
 * Contrast, Image Filters and Rounded Corners.
 *
 * Each one decodes nothing on its own — the workspace hands over the already
 * decoded image — and writes a single `ProcessResult`, exactly like the other
 * image processors. All maths happens on canvas ImageData in the browser.
 */
import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { canvasToBlob, encodableFormat } from '@/lib/image/format';
import { createCanvas, nameOf, outputName, sourceOf } from '@/lib/image/process';
import {
  applyBrightnessContrast,
  applyColorFilter,
  blurRadiusFor,
  blurRect,
  cornerRadiusFor,
  pixelBlockFor,
  pixelateRect,
  roundedRectPath,
  sharpenImage,
  toPixelRects,
  type FilterPreset,
  type NormRect,
} from '@/lib/image/effects';

interface BaseEffects {
  format: ImageFormat;
  quality?: number;
}

export interface BlurOptions extends BaseEffects {
  /** Blur strength in pixels at a 1000px-wide image. */
  amount: number;
  /** Redaction areas; empty/omitted blurs the whole image. */
  regions?: NormRect[];
}

export interface PixelateOptions extends BaseEffects {
  /** Block size in pixels at a 1000px-wide image. */
  blockSize: number;
  regions?: NormRect[];
}

export interface AdjustOptions extends BaseEffects {
  brightness: number; // -100…100
  contrast: number; // -100…100
}

export interface FilterOptions extends BaseEffects {
  preset: FilterPreset;
  /** 0–100; ignored by the sharpen preset's own scale. */
  strength?: number;
}

export interface RoundedCornersOptions extends BaseEffects {
  /** Corner radius as a percentage (0–50) of the shorter side. */
  radiusPercent: number;
  /** Painted under the image for formats without alpha (JPG/…). */
  background?: string;
}

/** Draw the decoded image onto a fresh canvas and hand its pixels to `mutate`. */
function withPixels(
  decoded: DecodedImage,
  mutate: (data: Uint8ClampedArray, width: number, height: number) => void,
): HTMLCanvasElement {
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  ctx.drawImage(sourceOf(decoded) as CanvasImageSource, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  mutate(imageData.data, canvas.width, canvas.height);
  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

async function encode(
  canvas: HTMLCanvasElement,
  decoded: DecodedImage,
  format: ImageFormat,
  quality: number,
): Promise<ProcessResult> {
  const out = encodableFormat(format);
  const blob = await canvasToBlob(canvas, { format: out, quality });
  return { blob, format: out, name: outputName(nameOf(decoded.file), out) };
}

/** Long edge is the reference for resolution-independent effect strengths. */
function longEdgeOf(w: number, h: number): number {
  return Math.max(w, h);
}

export async function blurImage(
  files: DecodedImage[],
  options: BlurOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const quality = options.quality ?? 0.92;
  const regions = options.regions ?? [];
  const canvas = withPixels(decoded, (data, width, height) => {
    const radius = blurRadiusFor(options.amount, longEdgeOf(width, height));
    if (!regions.length) {
      blurRect(data, width, height, null, radius);
      return;
    }
    for (const rect of toPixelRects(regions, width, height)) {
      blurRect(data, width, height, rect, radius);
    }
  });
  return encode(canvas, decoded, options.format, quality);
}

export async function pixelateImage(
  files: DecodedImage[],
  options: PixelateOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const quality = options.quality ?? 0.92;
  const regions = options.regions ?? [];
  const canvas = withPixels(decoded, (data, width, height) => {
    const block = pixelBlockFor(options.blockSize, longEdgeOf(width, height));
    if (!regions.length) {
      pixelateRect(data, width, height, null, block);
      return;
    }
    for (const rect of toPixelRects(regions, width, height)) {
      pixelateRect(data, width, height, rect, block);
    }
  });
  return encode(canvas, decoded, options.format, quality);
}

export async function adjustImage(
  files: DecodedImage[],
  options: AdjustOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const canvas = withPixels(decoded, (data) => {
    applyBrightnessContrast(data, options.brightness, options.contrast);
  });
  return encode(canvas, decoded, options.format, options.quality ?? 0.92);
}

export async function applyFilterEffect(
  files: DecodedImage[],
  options: FilterOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const strength = options.strength ?? 100;
  const canvas = withPixels(decoded, (data, width, height) => {
    if (options.preset === 'sharpen') {
      sharpenImage(data, width, height, strength);
      return;
    }
    applyColorFilter(data, options.preset, strength);
  });
  return encode(canvas, decoded, options.format, options.quality ?? 0.92);
}

export async function roundCorners(
  files: DecodedImage[],
  options: RoundedCornersOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const format = encodableFormat(options.format);
  const quality = options.quality ?? 0.92;
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  const radius = cornerRadiusFor(options.radiusPercent, canvas.width, canvas.height);

  // JPEG has no alpha channel: paint a solid background first so the corners
  // never collapse to black. PNG/WebP keep real transparency.
  const keepAlpha = format === 'png' || format === 'webp';
  if (!keepAlpha) {
    ctx.fillStyle = options.background ?? '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.save();
  roundedRectPath(ctx, 0, 0, canvas.width, canvas.height, radius);
  ctx.clip();
  ctx.drawImage(sourceOf(decoded) as CanvasImageSource, 0, 0);
  ctx.restore();

  const blob = await canvasToBlob(canvas, { format, quality });
  return { blob, format, name: outputName(nameOf(decoded.file), format) };
}
