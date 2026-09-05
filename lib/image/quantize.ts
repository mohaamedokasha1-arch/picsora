/**
 * 256-colour palette quantization (weighted median cut) used by the image
 * compressor so PNG output can genuinely shrink instead of silently falling
 * back to the original file (the "nothing happened" case).
 *
 * The algorithm runs in `/workers/png-quantize.worker.js` when a Worker is
 * available (zero-copy, keeps the UI responsive). This module owns the
 * reference implementation used as the main-thread fallback — and by the
 * automated tests — so both paths stay behaviourally identical.
 */

import type { DecodedImage } from '@/lib/types';
import { createCanvas } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';

export const QUANTIZE_COLORS = 256;

/** Safety cap: skip quantization for gigantic images (> ~45 MP). */
const MAX_QUANTIZE_PIXELS = 45_000_000;

/** 5 bits per channel → 32³ = 32768 histogram buckets. */
const SHIFT = 3; // 8 - 5
const LEVELS = 1 << 5;
const HIST_SIZE = LEVELS * LEVELS * LEVELS;

export interface QuantizeOutput {
  /** RGB triplets, length = colors * 3. */
  palette: Uint8Array;
  /** Per-pixel palette index, length = width * height. */
  indices: Uint8Array;
  colors: number;
}

function bucketOf(r: number, g: number, b: number): number {
  return ((r >> SHIFT) << 10) | ((g >> SHIFT) << 5) | (b >> SHIFT);
}

/**
 * Quantize an RGBA buffer to at most 256 colours. Alpha is preserved by the
 * caller; the histogram only counts visible pixels so transparent areas do
 * not distort the palette.
 */
export function quantizeRgba(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  maxColors = QUANTIZE_COLORS,
): QuantizeOutput | null {
  const total = width * height;
  if (total <= 0) return null;
  const hist = new Uint32Array(HIST_SIZE);
  let visible = 0;
  for (let p = 0; p < total; p += 1) {
    const o = p * 4;
    if (data[o + 3] === 0) continue;
    hist[bucketOf(data[o], data[o + 1], data[o + 2])] += 1;
    visible += 1;
  }

  // All-transparent image → a single empty palette entry.
  const empty = {
    palette: new Uint8Array([0, 0, 0]),
    indices: new Uint8Array(total),
    colors: 1,
  };
  if (!visible) return empty;

  // Median cut on histogram buckets (each bucket carries a pixel weight).
  let boxes: { buckets: number[]; weight: number }[] = [
    { buckets: Array.from({ length: HIST_SIZE }, (_, i) => i).filter((i) => hist[i] > 0), weight: visible },
  ];
  let guard = 0;
  while (boxes.length < maxColors && guard < 512) {
    guard += 1;
    let widest = -1;
    let widestRange = -1;
    for (let i = 0; i < boxes.length; i += 1) {
      const box = boxes[i];
      if (box.buckets.length < 2) continue;
      const range = bucketRange(box.buckets);
      if (range > widestRange) {
        widestRange = range;
        widest = i;
      }
    }
    if (widest < 0 || widestRange === 0) break;
    const box = boxes[widest];
    const channel = widestChannel(box.buckets);
    // Sort buckets along the widest channel, then split at half the weight.
    const sorted = [...box.buckets].sort(
      (a, b) => channelValue(a, channel) - channelValue(b, channel),
    );
    let leftWeight = 0;
    let splitAt = sorted.length;
    for (let i = 0; i < sorted.length; i += 1) {
      leftWeight += hist[sorted[i]];
      if (leftWeight * 2 >= box.weight) {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt <= 0 || splitAt >= sorted.length) break;
    const left = sorted.slice(0, splitAt);
    const right = sorted.slice(splitAt);
    boxes.splice(
      widest,
      1,
      { buckets: left, weight: leftWeight },
      { buckets: right, weight: box.weight - leftWeight },
    );
  }

  // Palette = weighted average of each box.
  const palette = new Uint8Array(maxColors * 3);
  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i];
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const bucket of box.buckets) {
      const w = hist[bucket];
      const bi = bucket;
      r += ((bi >> 10) & 31) * w;
      g += ((bi >> 5) & 31) * w;
      b += (bi & 31) * w;
      n += w;
    }
    if (!n) continue;
    // Bucket centres: shift back to the middle of each 8-value cell.
    palette[i * 3] = Math.round((r / n) * 8 + 4);
    palette[i * 3 + 1] = Math.round((g / n) * 8 + 4);
    palette[i * 3 + 2] = Math.round((b / n) * 8 + 4);
  }

  // Precompute nearest palette entry per bucket (32768 × ≤256 distance ops).
  const nearest = new Uint16Array(HIST_SIZE);
  for (let bucket = 0; bucket < HIST_SIZE; bucket += 1) {
    const br = (bucket >> 10) & 31;
    const bg = (bucket >> 5) & 31;
    const bb = bucket & 31;
    let best = 0;
    let bestDist = Infinity;
    for (let c = 0; c < boxes.length; c += 1) {
      const pr = palette[c * 3] >> SHIFT;
      const pg = palette[c * 3 + 1] >> SHIFT;
      const pb = palette[c * 3 + 2] >> SHIFT;
      const dr = br - pr;
      const dg = bg - pg;
      const db = bb - pb;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    nearest[bucket] = best;
  }

  const indices = new Uint8Array(total);
  for (let p = 0; p < total; p += 1) {
    const o = p * 4;
    indices[p] = nearest[bucketOf(data[o], data[o + 1], data[o + 2])];
  }

  return { palette, indices, colors: boxes.length };
}

function channelValue(bucket: number, channel: number): number {
  if (channel === 0) return (bucket >> 10) & 31;
  if (channel === 1) return (bucket >> 5) & 31;
  return bucket & 31;
}

function bucketRange(buckets: number[]): number {
  let min = [31, 31, 31];
  let max = [0, 0, 0];
  for (const b of buckets) {
    const r = (b >> 10) & 31;
    const g = (b >> 5) & 31;
    const bl = b & 31;
    if (r < min[0]) min[0] = r;
    if (g < min[1]) min[1] = g;
    if (bl < min[2]) min[2] = bl;
    if (r > max[0]) max[0] = r;
    if (g > max[1]) max[1] = g;
    if (bl > max[2]) max[2] = bl;
  }
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

function widestChannel(buckets: number[]): number {
  let min = [31, 31, 31];
  let max = [0, 0, 0];
  for (const b of buckets) {
    const r = (b >> 10) & 31;
    const g = (b >> 5) & 31;
    const bl = b & 31;
    if (r < min[0]) min[0] = r;
    if (g < min[1]) min[1] = g;
    if (bl < min[2]) min[2] = bl;
    if (r > max[0]) max[0] = r;
    if (g > max[1]) max[1] = g;
    if (bl > max[2]) max[2] = bl;
  }
  const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (ranges[0] >= ranges[1] && ranges[0] >= ranges[2]) return 0;
  if (ranges[1] >= ranges[2]) return 1;
  return 2;
}

/* ------------------------------------------------------------------ runner */

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, (value: QuantizeOutput | null) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker('/workers/png-quantize.worker.js');
  worker.onmessage = (e: MessageEvent) => {
    const { id, palette, indices, colors, error } = e.data;
    const resolve = pending.get(id);
    if (!resolve) return;
    pending.delete(id);
    if (error) {
      resolve(null);
      return;
    }
    resolve({
      palette: new Uint8Array(palette),
      indices: new Uint8Array(indices),
      colors: colors ?? QUANTIZE_COLORS,
    });
  };
  worker.onerror = () => {
    // Fail open: reject all pending calls so the main-thread path is used.
    for (const resolve of pending.values()) resolve(null);
    pending.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function runInWorker(
  buffer: ArrayBuffer,
  width: number,
  height: number,
): Promise<QuantizeOutput | null> {
  return new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    try {
      getWorker().postMessage({ id, buffer, width, height }, [buffer]);
    } catch {
      pending.delete(id);
      resolve(null);
    }
  });
}

export async function quantizeRgbaAsync(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<QuantizeOutput | null> {
  if (width * height > MAX_QUANTIZE_PIXELS) return null;
  const copy = data.slice().buffer;
  if (typeof Worker !== 'undefined') {
    try {
      return await runInWorker(copy, width, height);
    } catch {
      /* main-thread fallback below */
    }
  }
  // Yield once so the UI can paint the "Processing…" indicator before the
  // synchronous reference implementation blocks the main thread.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return quantizeRgba(data, width, height);
}

/**
 * Encode a decoded image as a 256-colour PNG. Returns null when the image is
 * too large or quantization cannot run.
 */
export async function quantizeToPng(decoded: DecodedImage): Promise<Blob | null> {
  const { width, height } = decoded;
  if (width * height > MAX_QUANTIZE_PIXELS) return null;
  const { canvas, ctx } = createCanvas(width, height);
  ctx.drawImage((decoded.bitmap ?? decoded.image) as CanvasImageSource, 0, 0);
  const imageData = ctx.getImageData(0, 0, width, height);
  const quantized = await quantizeRgbaAsync(imageData.data, width, height);
  if (!quantized) return null;

  const out = createCanvas(width, height);
  const outCtx = out.ctx;
  const target = outCtx.createImageData(width, height);
  const src = imageData.data;
  const dst = target.data;
  const { palette, indices } = quantized;
  const total = width * height;
  for (let p = 0; p < total; p += 1) {
    const o = p * 4;
    const pi = indices[p] * 3;
    dst[o] = palette[pi];
    dst[o + 1] = palette[pi + 1];
    dst[o + 2] = palette[pi + 2];
    dst[o + 3] = src[o + 3]; // keep the original alpha channel
  }
  outCtx.putImageData(target, 0, 0);
  return canvasToBlob(out.canvas, { format: 'png' });
}
