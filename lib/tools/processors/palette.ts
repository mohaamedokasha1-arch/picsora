import type { DecodedImage, PaletteColor } from '@/lib/types';
import { createCanvas } from '@/lib/image/process';
import { rgbToHex } from '@/lib/image/process';

export interface PaletteOptions {
  count: number;
}

export interface PaletteOutput {
  colors: PaletteColor[];
}

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (value: PaletteColor[]) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker('/workers/palette.worker.js');
  worker.onmessage = (e) => {
    const { id, colors, error } = e.data;
    const resolve = pending.get(id);
    if (resolve) {
      pending.delete(id);
      if (error) {
        resolve([]);
      } else {
        resolve(
          (colors as { r: number; g: number; b: number; share: number }[]).map((c) => ({
            r: c.r,
            g: c.g,
            b: c.b,
            hex: rgbToHex(c.r, c.g, c.b),
            share: c.share,
          })),
        );
      }
    }
  };
  return worker;
}

function runInWorker(buffer: ArrayBuffer, width: number, height: number, count: number): Promise<PaletteColor[]> {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    getWorker().postMessage({ id, buffer, width, height, count }, [buffer]);
  });
}

export async function extractPalette(
  files: DecodedImage[],
  options: PaletteOptions,
): Promise<PaletteOutput> {
  const decoded = files[0];
  const count = Math.max(2, Math.min(10, options.count));
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);
  const imageData = ctx.getImageData(0, 0, decoded.width, decoded.height);
  // Transfer the buffer to the worker (zero-copy).
  const buffer = imageData.data.buffer.slice(0);
  const colors = await runInWorker(buffer, decoded.width, decoded.height, count);
  return { colors };
}
