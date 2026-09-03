/**
 * Transparency detection and transparent-canvas helpers.
 * Client-side only — uses a scaled-down sample to keep it fast on large images.
 */

import type { DecodedImage } from '@/lib/types';

/**
 * Rapidly detect whether a decoded image contains any non-opaque pixels.
 * Draws onto a 100×100 sample canvas to avoid reading full-resolution data.
 */
export function hasAlpha(decoded: DecodedImage): boolean {
  const src = decoded.bitmap ?? decoded.image;
  const maxDim = 100;
  const scale = Math.min(1, maxDim / Math.max(decoded.width, decoded.height || 1));
  const w = Math.max(1, Math.round(decoded.width * scale));
  const h = Math.max(1, Math.round(decoded.height * scale));

  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return false;

  // Draw sample — preserve alpha channel
  ctx.drawImage(src as CanvasImageSource, 0, 0, w, h);

  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 3; i < d.length; i += 4) {
    if (d[i] < 255) return true;
  }
  return false;
}

/**
 * Prepare a fresh canvas for drawing, clearing it to fully transparent.
 * Always call this before drawing into a reused or new canvas.
 */
export function clearCanvas(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.clearRect(0, 0, w, h);
}

/**
 * Fill a canvas with a background color (used when output format is lossy
 * and the source has alpha — prevents black-background artifacts).
 */
export function fillBackground(ctx: CanvasRenderingContext2D, color: string, w: number, h: number) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
}
