import type { DecodedImage, ProcessResult } from '@/lib/types';
import { nameOf } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';

export interface SignatureOptions {
  /** 0..100 — higher keeps more of light strokes, lower keeps only dark ink. */
  threshold: number;
  /** Ink colour of the final signature. */
  ink: string;
  /** Enable when the photo is light ink on a dark background. */
  invert: boolean;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/**
 * Turn a photo of a handwritten signature into a clean transparent PNG:
 * luminance thresholding builds the alpha channel, the chosen ink colour is
 * applied, and the result is auto-cropped to the ink bounding box.
 */
export async function makeSignature(
  files: DecodedImage[],
  options: SignatureOptions,
): Promise<ProcessResult[]> {
  const decoded = files[0];
  const w = decoded.width;
  const h = decoded.height;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('no-2d-context');
  ctx.drawImage((decoded.bitmap ?? decoded.image) as CanvasImageSource, 0, 0);

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const thr = (Math.max(0, Math.min(100, options.threshold)) / 100) * 255;
  const ramp = 56;
  const ink = hexToRgb(options.ink || '#000000');

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = options.invert ? 255 - lum : lum;
    let alpha: number;
    if (v <= thr - ramp) alpha = 255;
    else if (v >= thr) alpha = 0;
    else alpha = Math.round(255 * (1 - (v - (thr - ramp)) / ramp));
    d[i] = ink.r;
    d[i + 1] = ink.g;
    d[i + 2] = ink.b;
    d[i + 3] = alpha;
    if (alpha > 10) {
      const px = (i / 4) % w;
      const py = Math.floor(i / 4 / w);
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py < minY) minY = py;
      if (py > maxY) maxY = py;
    }
  }

  if (maxX < 0) throw new Error('signature-empty');
  ctx.putImageData(img, 0, 0);

  // Auto-crop to content with breathing room.
  const pad = Math.max(8, Math.round(Math.min(w, h) * 0.04));
  const cx = Math.max(0, minX - pad);
  const cy = Math.max(0, minY - pad);
  const cw = Math.min(w - cx, maxX - minX + pad * 2);
  const ch = Math.min(h - cy, maxY - minY + pad * 2);

  const out = document.createElement('canvas');
  out.width = Math.max(1, cw);
  out.height = Math.max(1, ch);
  const octx = out.getContext('2d');
  if (!octx) throw new Error('no-2d-context');
  octx.drawImage(canvas, cx, cy, cw, ch, 0, 0, out.width, out.height);

  const blob = await canvasToBlob(out, { format: 'png' });
  canvas.width = 0;
  canvas.height = 0;
  out.width = 0;
  out.height = 0;
  return [{ blob, format: 'png', name: `${nameOf(decoded.file)}-signature.png` }];
}
