import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob, supportsWebPEncode } from '@/lib/image/format';

export interface ExactSizeOptions {
  /** Desired output size in kilobytes. */
  targetKB: number;
  format: ImageFormat;
}

export interface ExactSizeResult extends ProcessResult {
  originalSize: number;
  outputSize: number;
  targetBytes: number;
  /** True when the output is at or under the requested size. */
  hit: boolean;
  finalWidth: number;
  finalHeight: number;
  finalQuality: number;
}

function drawScaled(decoded: DecodedImage, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  const src = (decoded.bitmap ?? decoded.image) as CanvasImageSource;
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/**
 * Hit an exact file-size target by searching quality first (keeps full
 * resolution whenever possible) and only then stepping dimensions down.
 * Everything runs locally; every encode uses the browser's native encoder.
 */
export async function compressToExactSize(
  files: DecodedImage[],
  options: ExactSizeOptions,
): Promise<ExactSizeResult[]> {
  const targetBytes = Math.max(5 * 1024, Math.round(options.targetKB * 1024));
  if (options.format === 'webp' && !supportsWebPEncode()) {
    throw new Error('webp-unsupported');
  }

  const results: ExactSizeResult[] = [];
  for (const file of files) {
    results.push(await hitTarget(file, options.format, targetBytes));
  }
  return results;
}

async function hitTarget(
  decoded: DecodedImage,
  format: ImageFormat,
  targetBytes: number,
): Promise<ExactSizeResult> {
  const originalSize = decoded.file.size;
  const fullW = decoded.width;
  const fullH = decoded.height;

  const encode = async (w: number, h: number, q: number) =>
    canvasToBlob(drawScaled(decoded, w, h), { format, quality: q });

  // Phase 1 — probe a few qualities at full resolution to bracket the target.
  const probes = [0.85, 0.6, 0.4, 0.2, 0.08];
  let lo = 0.05;
  let hi = 0.95;
  let best: { blob: Blob; q: number; w: number; h: number } | null = null;

  for (const q of probes) {
    const blob = await encode(fullW, fullH, q);
    if (blob.size <= targetBytes) {
      best = { blob, q, w: fullW, h: fullH };
      lo = q;
      break;
    }
    hi = q;
    lo = Math.min(lo, q - 0.05);
  }

  // Phase 2 — bisect upwards for the best quality that still fits.
  if (best) {
    let low = best.q;
    let high = Math.min(0.95, best.q + 0.3);
    // Verify the upper bound actually exceeds the target; if not, use it.
    const highBlob = await encode(fullW, fullH, high);
    if (highBlob.size <= targetBytes) {
      best = { blob: highBlob, q: high, w: fullW, h: fullH };
    } else {
      for (let i = 0; i < 4; i += 1) {
        const mid = (low + high) / 2;
        const blob = await encode(fullW, fullH, mid);
        if (blob.size <= targetBytes) {
          best = { blob, q: mid, w: fullW, h: fullH };
          low = mid;
        } else {
          high = mid;
        }
      }
    }
    return finish(decoded, format, originalSize, targetBytes, best, true);
  }

  // Phase 3 — shrink dimensions stepwise, keeping quality as high as fits.
  const scales = [0.8, 0.6, 0.45, 0.32, 0.22, 0.15];
  for (const s of scales) {
    const w = Math.max(16, Math.round(fullW * s));
    const h = Math.max(16, Math.round(fullH * s));
    const probe = await encode(w, h, 0.72);
    if (probe.size <= targetBytes) {
      let low = 0.3;
      let high = 0.9;
      let cur: { blob: Blob; q: number; w: number; h: number } = { blob: probe, q: 0.72, w, h };
      for (let i = 0; i < 3; i += 1) {
        const mid = (low + high) / 2;
        const blob = await encode(w, h, mid);
        if (blob.size <= targetBytes) {
          cur = { blob, q: mid, w, h };
          low = mid;
        } else {
          high = mid;
        }
      }
      return finish(decoded, format, originalSize, targetBytes, cur, true);
    }
    best = { blob: probe, q: 0.72, w, h };
    void hi;
    void lo;
  }

  // Nothing fits — return the smallest we produced with an honest flag.
  return finish(decoded, format, originalSize, targetBytes, best!, false);
}

function finish(
  decoded: DecodedImage,
  format: ImageFormat,
  originalSize: number,
  targetBytes: number,
  best: { blob: Blob; q: number; w: number; h: number },
  hit: boolean,
): ExactSizeResult {
  return {
    blob: best.blob,
    format,
    name: outputName(nameOf(decoded.file), format),
    originalSize,
    outputSize: best.blob.size,
    targetBytes,
    hit,
    finalWidth: best.w,
    finalHeight: best.h,
    finalQuality: Math.round(best.q * 100),
  };
}
