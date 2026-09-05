import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { encodeDecodedToBlob, nameOf, outputName } from '@/lib/image/process';
import { encodableFormat, supportsWebPEncode } from '@/lib/image/format';
import { hasAlpha } from '@/lib/image/transparent';

export interface CompressorOptions {
  quality: number; // 1..100
  format: ImageFormat | 'same';
}

export interface SmartCompressedResult extends ProcessResult {
  /** True only when the output is genuinely smaller than the original. */
  wasCompressed: boolean;
  originalSize: number;
  outputSize: number;
  /** Quality actually used for the winning encode (lossy formats only). */
  finalQuality?: number;
  /**
   * Outcome key the UI renders:
   * - `compressed-success`          → output is smaller than the original
   * - `same-size`                   → output landed on exactly the same size
   * - `original-fallback-inflation` → same-format run where every attempt
   *   would INFLATE the file, so the untouched original is delivered instead
   *   (typical for optimised PNGs)
   * - `converted-larger`            → the user explicitly asked for a
   *   different container; the requested format is delivered even though it
   *   is not smaller (badge shows the honest +X%)
   */
  message?:
    | 'compressed-success'
    | 'same-size'
    | 'original-fallback-inflation'
    | 'converted-larger';
}

/** Lowest quality the binary search will consider (0..1 scale). */
const FLOOR_QUALITY = 0.05;
/** Encoding iterations cap — keeps huge batches responsive. */
const MAX_SEARCH_ITERATIONS = 6;

function isLossy(format: ImageFormat): boolean {
  return format === 'jpg' || format === 'jpeg' || format === 'webp';
}

/**
 * Smart compression:
 *
 * - LOSSY outputs (JPG/WebP): encode at the user's quality first. When that
 *   would inflate the file, binary-search UPWARD for the highest quality that
 *   still beats the original size — closest to the user's intent instead of
 *   cratering the image at minimum quality.
 * - LOSSLESS outputs (PNG): quality does not apply; the canvas re-encode is
 *   compared once against the original.
 * - The original file is delivered back ONLY when no attempt can beat it, and
 *   the result then carries `wasCompressed: false` + a `message` so the UI can
 *   tell the user exactly what happened (no more silent "nothing happened").
 * - JPEG output of an image with transparency is painted on white first, so
 *   transparent logos never come out on a black background.
 */
export async function compressImages(
  files: DecodedImage[],
  options: CompressorOptions,
): Promise<SmartCompressedResult[]> {
  // An explicit WebP request on a browser that cannot encode WebP must fail
  // loudly (same contract as the converter tools) — otherwise canvas silently
  // hands back PNG bytes mislabelled as .webp.
  if (options.format === 'webp' && !supportsWebPEncode()) {
    throw new Error('webp-unsupported');
  }

  const results: SmartCompressedResult[] = [];

  for (const file of files) {
    const originalFile = file.file;
    const originalSize = originalFile.size;
    const rawFormat = options.format === 'same' ? file.format : options.format;
    // `encodableFormat` also maps webp→png on browsers without a WebP encoder,
    // so a 'same-format' run can never emit mislabelled bytes.
    const format: ImageFormat = encodableFormat(rawFormat);

    // Transparent source + opaque output → paint white (matches resizer/cropper).
    const background =
      (format === 'jpg' || format === 'jpeg') && hasAlpha(file) ? '#ffffff' : undefined;

    const userQuality = Math.max(0.01, Math.min(1, options.quality / 100));
    const encode = (q: number) => encodeDecodedToBlob(file, format, q, { background });

    let blob = await encode(userQuality);
    let quality = userQuality;

    if (isLossy(format) && blob.size > originalSize) {
      // The user's quality inflates the file — find the HIGHEST quality below
      // it that still produces a smaller file than the original.
      const floorBlob = await encode(FLOOR_QUALITY);
      if (floorBlob.size < originalSize) {
        let lo = FLOOR_QUALITY; // known to fit
        let hi = userQuality; // known NOT to fit
        let best = floorBlob;
        let bestQ = FLOOR_QUALITY;
        for (let i = 0; i < MAX_SEARCH_ITERATIONS && hi - lo > 0.01; i += 1) {
          const mid = (lo + hi) / 2;
          const trial = await encode(mid);
          if (trial.size < originalSize) {
            best = trial;
            bestQ = mid;
            lo = mid; // try to get closer to the user's requested quality
          } else {
            hi = mid;
          }
        }
        blob = best;
        quality = bestQ;
      } else {
        blob = floorBlob;
        quality = FLOOR_QUALITY;
      }
    }

    const baseName = nameOf(originalFile);

    if (blob.size < originalSize) {
      results.push({
        blob,
        format,
        name: outputName(baseName, format),
        wasCompressed: true,
        originalSize,
        outputSize: blob.size,
        finalQuality: isLossy(format) ? Math.round(quality * 100) : undefined,
        message: 'compressed-success',
      });
    } else if (options.format !== 'same') {
      // The user explicitly asked for a different container — deliver the
      // REQUESTED format even when it is not smaller (that is the processing
      // they asked for); the result badge shows the honest +X% change.
      results.push({
        blob,
        format,
        name: outputName(baseName, format),
        wasCompressed: false,
        originalSize,
        outputSize: blob.size,
        finalQuality: isLossy(format) ? Math.round(quality * 100) : undefined,
        message: blob.size === originalSize ? 'same-size' : 'converted-larger',
      });
    } else {
      // Same-format run where no attempt beats the original (typical: an
      // already-optimised PNG — lossless re-encode ignores quality and comes
      // out larger, or exactly the same size). Deliver the ORIGINAL bytes
      // with their ORIGINAL format/name so nothing is mislabelled, flagged so
      // the UI explains the outcome instead of silently looking like nothing
      // happened.
      results.push({
        blob: originalFile,
        format: file.format,
        name: outputName(baseName, file.format === 'jpeg' ? 'jpg' : file.format),
        wasCompressed: false,
        originalSize,
        outputSize: originalSize,
        message: blob.size === originalSize ? 'same-size' : 'original-fallback-inflation',
      });
    }
  }

  return results;
}
