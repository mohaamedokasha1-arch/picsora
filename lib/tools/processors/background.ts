import type { DecodedImage, ProcessResult } from '@/lib/types';
import { nameOf } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';

export interface BgRemoveOptions {
  /** 0..100 — how close a pixel must be to the background colour to vanish. */
  tolerance: number;
  /** 0..100 — softens edges between kept and removed areas. */
  feather: number;
  /** Where the background colour is sampled from. */
  source: 'corners' | 'white';
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

function sampleCorners(ctx: CanvasRenderingContext2D, w: number, h: number): RGB {
  const s = 6;
  const spots = [
    [0, 0],
    [w - s, 0],
    [0, h - s],
    [w - s, h - s],
  ];
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const [x, y] of spots) {
    try {
      const d = ctx.getImageData(Math.max(0, x), Math.max(0, y), s, s).data;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n += 1;
      }
    } catch {
      /* unreadable corner — ignore */
    }
  }
  if (!n) return { r: 255, g: 255, b: 255 };
  return { r: r / n, g: g / n, b: b / n };
}

/**
 * Local chroma-key background remover. Best for product shots, logos and
 * signatures on solid backgrounds: pixels near the sampled background colour
 * become transparent, edges are feathered. Always exports PNG with alpha.
 */
export async function removeBackground(
  files: DecodedImage[],
  options: BgRemoveOptions,
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

  const key: RGB =
    options.source === 'white' ? { r: 255, g: 255, b: 255 } : sampleCorners(ctx, w, h);

  const tol = (Math.max(0, Math.min(100, options.tolerance)) / 100) * 441.67;
  const feather = 1 + (Math.max(0, Math.min(100, options.feather)) / 100) * 160;

  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const dr = d[i] - key.r;
    const dg = d[i + 1] - key.g;
    const db = d[i + 2] - key.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    let keep: number;
    if (dist <= tol) keep = 0;
    else if (dist >= tol + feather) keep = 1;
    else {
      const x = (dist - tol) / feather;
      keep = x * x * (3 - 2 * x); // smoothstep
    }
    d[i + 3] = Math.round(d[i + 3] * keep);
  }
  ctx.putImageData(img, 0, 0);

  const blob = await canvasToBlob(canvas, { format: 'png' });
  canvas.width = 0;
  canvas.height = 0;
  return [{ blob, format: 'png', name: `${nameOf(decoded.file)}-no-bg.png` }];
}
