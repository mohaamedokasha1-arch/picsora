import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { encodeDecodedToBlob, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob, encodableFormat } from '@/lib/image/format';

export interface CompressorOptions {
  quality: number; // 1..100
  format: ImageFormat | 'same';
}

export interface SmartCompressedResult extends ProcessResult {
  wasCompressed: boolean;
  originalSize: number;
  outputSize: number;
  message?: string;
}

/**
 * Smart compression with binary-search quality tuning.
 * If the compressed output is larger than the original, falls back to the original file.
 */
export async function compressImages(
  files: DecodedImage[],
  options: CompressorOptions,
): Promise<SmartCompressedResult[]> {
  const results: SmartCompressedResult[] = [];

  for (const file of files) {
    const originalFile = file.file;
    const originalSize = originalFile.size;
    const rawFormat = options.format === 'same' ? file.format : options.format;
    const format: ImageFormat = encodableFormat(rawFormat);

    // Initial quality based on user setting
    let bestQuality = Math.max(0.01, Math.min(1, options.quality / 100));
    let bestBlob = await encodeDecodedToBlob(file, format, bestQuality);
    let bestSize = bestBlob.size;

    // If already smaller or equal, done.
    if (bestSize <= originalSize) {
      results.push({
        blob: bestBlob,
        format,
        name: outputName(nameOf(originalFile), format),
        wasCompressed: true,
        originalSize,
        outputSize: bestSize,
        message: bestSize < originalSize ? 'compressed-success' : 'same-size',
      });
      continue;
    }

    // Binary search for lower quality until output <= original or min reached.
    let lo = 0.05;
    let hi = bestQuality;
    let iterations = 0;
    const maxIter = 6; // cap to avoid excessive processing
    let foundBetter = false;

    while (lo < hi && iterations < maxIter) {
      const mid = (lo + hi) / 2;
      const trialBlob = await encodeDecodedToBlob(file, format, mid);
      const trialSize = trialBlob.size;

      if (trialSize <= originalSize) {
        // This quality works; try to see if we can go lower (smaller file)
        bestBlob = trialBlob;
        bestSize = trialSize;
        foundBetter = true;
        hi = mid;
      } else {
        // Still too large; need lower quality (higher compression)
        lo = mid;
      }
      iterations++;
    }

    // After binary search, if still larger, try very low quality once more (0.05)
    if (bestSize > originalSize) {
      const lowBlob = await encodeDecodedToBlob(file, format, 0.05);
      if (lowBlob.size <= bestSize) {
        bestBlob = lowBlob;
        bestSize = lowBlob.size;
      }
    }

    if (bestSize <= originalSize) {
      results.push({
        blob: bestBlob,
        format,
        name: outputName(nameOf(originalFile), format),
        wasCompressed: true,
        originalSize,
        outputSize: bestSize,
        message: 'compressed-success',
      });
    } else {
      // Fallback: return original file blob converted to output format? No —
      // user's requirement: if output is larger even at minimum quality,
      // return original file (preserve quality) with clear message.
      // We must return a Blob of the original file, but with the requested output format?
      // Actually the user wants the original file delivered to the user.
      // We'll return original blob but keep requested format in metadata? No,
      // the tool should deliver the original file unchanged.
      // However the architecture expects a Blob from canvas. To preserve original,
      // we can read the original file into a blob directly.
      // Fallback: deliver original file unchanged (File extends Blob).
      results.push({
        blob: file.file,
        format,
        name: outputName(nameOf(file.file), format),
        wasCompressed: false,
        originalSize,
        outputSize: originalSize,
        message: 'original-fallback-inflation',
      });
    }
  }

  return results;
}
