import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { encodeDecodedToBlob, nameOf, outputName } from '@/lib/image/process';
import { encodableFormat } from '@/lib/image/format';
import { quantizeToPng } from '@/lib/image/quantize';

export interface CompressorOptions {
  quality: number; // 1..100
  format: ImageFormat | 'same';
}

export interface SmartCompressedResult extends ProcessResult {
  wasCompressed: boolean;
  originalSize: number;
  outputSize: number;
  /** Result message key resolved by the UI (toolShell.resultMessages.*). */
  message?: string;
  finalQuality?: number;
}

/**
 * Smart compression.
 *
 * Every run performs a REAL processing pass and returns the re-encoded image:
 * the original bytes are never handed back silently (that was the "same old
 * size, nothing happened" bug). When even the best real encode cannot beat
 * the original, the processed result is still returned — with `wasCompressed:
 * false` and a message explaining why — instead of faking success.
 *
 * - Lossy formats (JPG/WebP): encodes at the user's quality first, then sweeps
 *   lower qualities and keeps the highest one that is smaller than the input.
 * - PNG (or any source converted to PNG): plain lossless re-encode first; if
 *   that cannot shrink the file, a 256-colour palette quantization pass runs
 *   (`lib/image/quantize.ts`), which is what actually makes PNGs smaller.
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
    const userQuality = Math.max(0.01, Math.min(1, options.quality / 100));
    const isLossy = format === 'jpg' || format === 'jpeg' || format === 'webp';

    // 1) Encode at the quality the user selected — this is the real result
    //    they asked for and the blob we deliver if nothing smaller wins.
    let bestBlob = await encodeDecodedToBlob(file, format, userQuality);
    let bestSize = bestBlob.size;
    let bestQuality = userQuality;

    if (isLossy && bestSize <= originalSize) {
      results.push(
        makeResult(file, format, bestBlob, originalSize, true, {
          message: bestSize < originalSize ? 'compressed-success' : 'same-size',
          finalQuality: Math.round(bestQuality * 100),
        }),
      );
      continue;
    }
    if (!isLossy && bestSize < originalSize) {
      results.push(
        makeResult(file, format, bestBlob, originalSize, true, {
          message: 'compressed-success',
        }),
      );
      continue;
    }

    if (isLossy) {
      // 2) Lossy: hunt for the HIGHEST quality whose output is smaller than
      //    the original. Each candidate is a genuine re-encode.
      const sweep = [0.8, 0.65, 0.5, 0.38, 0.26, 0.16, 0.08, 0.05].filter(
        (q) => q < bestQuality,
      );
      for (const q of sweep) {
        const trial = await encodeDecodedToBlob(file, format, q);
        if (trial.size <= originalSize) {
          bestBlob = trial;
          bestSize = trial.size;
          bestQuality = q;
          break;
        }
        if (trial.size < bestSize) {
          bestBlob = trial;
          bestSize = trial.size;
          bestQuality = q;
        }
      }

      if (bestSize <= originalSize) {
        results.push(
          makeResult(file, format, bestBlob, originalSize, true, {
            message: 'compressed-success',
            finalQuality: Math.round(bestQuality * 100),
          }),
        );
      } else {
        // Delivered blob = the user's quality re-encode (actual processing),
        // not the original file. Reported honestly.
        const delivered =
          bestQuality === userQuality ? bestBlob : await encodeDecodedToBlob(file, format, userQuality);
        results.push(
          makeResult(file, format, delivered, originalSize, false, {
            message: 'larger-output',
            finalQuality: Math.round(userQuality * 100),
          }),
        );
      }
      continue;
    }

    // 3) Lossless (PNG): plain re-encode could not beat the original —
    //    try the palette-quantized PNG pass so the tool still compresses.
    const quantized = await quantizeToPng(file);
    if (quantized && quantized.size < bestSize) {
      bestBlob = quantized;
      bestSize = quantized.size;
      if (bestSize <= originalSize) {
        results.push(
          makeResult(file, 'png', bestBlob, originalSize, true, {
            message: 'palette-compressed',
          }),
        );
        continue;
      }
    }

    results.push(
      makeResult(file, format, bestBlob, originalSize, bestSize < originalSize, {
        message:
          bestSize < originalSize
            ? 'compressed-success'
            : bestSize === originalSize
              ? 'same-size'
              : 'larger-output',
      }),
    );
  }

  return results;
}

function makeResult(
  file: DecodedImage,
  format: ImageFormat,
  blob: Blob,
  originalSize: number,
  wasCompressed: boolean,
  extra: Omit<Partial<SmartCompressedResult>, 'blob' | 'format' | 'name' | 'originalSize' | 'outputSize' | 'wasCompressed'>,
): SmartCompressedResult {
  return {
    blob,
    format,
    name: outputName(nameOf(file.file), format),
    wasCompressed,
    originalSize,
    outputSize: blob.size,
    ...extra,
  };
}
