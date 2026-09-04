import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, fillBackground, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';
import { hasAlpha, clearCanvas } from '@/lib/image/transparent';

export interface ExactKbOptions {
  targetKB: number;
  format?: ImageFormat | 'same';
  maxScaleDown?: number; // min scale factor, default 0.2 (20%)
}

export interface ExactKbResult extends ProcessResult {
  originalSize: number;
  targetSize: number;
  outputSize: number;
  finalQuality: number;
  scaleFactor: number;
  reachedTarget: boolean;
  deltaPercent: number;
  message?: string;
}

export async function compressToExactKb(
  files: DecodedImage[],
  options: ExactKbOptions,
  onProgress?: (percent: number, text?: string) => void,
): Promise<ExactKbResult[]> {
  const results: ExactKbResult[] = [];
  const targetBytes = options.targetKB * 1024;

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    const originalFile = file.file;
    const originalSize = originalFile.size;
    const rawFormat = options.format === 'same' || !options.format ? file.format : options.format;
    // Lossy formats work best for exact size targeting; if PNG is chosen, use WebP or JPEG fallback if needed
    const format: ImageFormat = rawFormat === 'gif' ? 'jpg' : rawFormat;

    let bestBlob: Blob | null = null;
    let bestSize = 0;
    let bestQuality = 0.85;
    let bestScale = 1.0;
    let minDiff = Infinity;

    // Scale factors to try if quality reduction alone isn't sufficient
    const scaleFactors = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2];

    for (let sIdx = 0; sIdx < scaleFactors.length; sIdx++) {
      const scale = scaleFactors[sIdx];
      const targetW = Math.max(16, Math.round(file.width * scale));
      const targetH = Math.max(16, Math.round(file.height * scale));

      const { canvas, ctx } = createCanvas(targetW, targetH);
      clearCanvas(ctx, targetW, targetH);

      const isOpaque = format === 'jpg' || format === 'jpeg';
      if (isOpaque && hasAlpha(file)) {
        fillBackground(ctx, '#ffffff', targetW, targetH);
      }

      if (file.bitmap) {
        ctx.drawImage(file.bitmap, 0, 0, targetW, targetH);
      } else {
        ctx.drawImage(file.image, 0, 0, targetW, targetH);
      }

      // Binary search quality for this scale
      let lo = 0.02;
      let hi = 0.98;
      let iterations = 0;

      while (lo <= hi && iterations < 7) {
        const midQuality = (lo + hi) / 2;
        const blob = await canvasToBlob(canvas, { format, quality: midQuality });
        const size = blob.size;
        const diff = Math.abs(size - targetBytes);

        if (diff < minDiff) {
          minDiff = diff;
          bestBlob = blob;
          bestSize = size;
          bestQuality = midQuality;
          bestScale = scale;
        }

        // If within 3% of target, we are very close!
        if (diff / targetBytes < 0.03) {
          break;
        }

        if (size > targetBytes) {
          hi = midQuality - 0.05;
        } else {
          lo = midQuality + 0.05;
        }
        iterations++;
      }

      // Check progress callback
      if (onProgress) {
        const overallPercent = Math.round(((fileIdx + (sIdx + 1) / scaleFactors.length) / files.length) * 100);
        onProgress(overallPercent, `Optimizing image ${fileIdx + 1} of ${files.length}...`);
      }

      // If we found a result that is <= targetBytes and within 5%, or very close, stop scaling down
      if (bestBlob && bestSize <= targetBytes && (targetBytes - bestSize) / targetBytes <= 0.08) {
        break;
      }
    }

    if (!bestBlob) {
      bestBlob = await canvasToBlob(file.bitmap ? (file.bitmap as unknown as HTMLCanvasElement) : file.image as unknown as HTMLCanvasElement, { format, quality: 0.5 });
      bestSize = bestBlob.size;
    }

    const deltaPercent = Number((((bestSize - targetBytes) / targetBytes) * 100).toFixed(1));
    const reachedTarget = Math.abs(deltaPercent) <= 8;

    results.push({
      blob: bestBlob,
      format,
      name: outputName(`${nameOf(originalFile)}-${options.targetKB}kb`, format),
      originalSize,
      targetSize: targetBytes,
      outputSize: bestSize,
      finalQuality: Math.round(bestQuality * 100),
      scaleFactor: Math.round(bestScale * 100),
      reachedTarget,
      deltaPercent,
      message: reachedTarget ? 'exact-kb-success' : 'closest-match',
    });
  }

  return results;
}
