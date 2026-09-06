import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { encodeDecodedToBlob, nameOf, outputName } from '@/lib/image/process';
import { encodableFormat, supportsWebPEncode } from '@/lib/image/format';
import { hasAlpha } from '@/lib/image/transparent';

export interface CompressorOptions {
  quality: number; // 1..100 — the MAXIMUM quality the tool may use
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
   * Set on the extra WebP copy offered alongside an unshrinkable original
   * (optimised PNGs): the user gets both and picks.
   */
  suggested?: boolean;
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

/**
 * Compression policy — "serious, but never garbage":
 *
 * TARGET_SAVINGS: when the user's quality ceiling does not already achieve a
 * real reduction, the tool searches for the HIGHEST quality that saves at
 * least this fraction of the original size. Measurements on typical inputs
 * (phone/web JPEGs) show q≈45-70 is where real savings live; q80 re-encodes
 * of already-compressed JPEGs save almost nothing, which users experience as
 * "the tool didn't compress".
 *
 * QUALITY_FLOOR: preferred visual-safety floor.
 * QUALITY_HARD_FLOOR: absolute floor used only for "wrung-out" inputs (JPEGs
 * already saved around q55-q65) where even the preferred floor cannot reach
 * the target — measured curves show q35 unlocks 15-50% savings there while
 * the old code destroyed such images at q≈6.
 *
 * When even the hard floor cannot reach the target, the smallest encode above
 * it is delivered if it still beats the original (maximum honest
 * compression); otherwise the original comes back unchanged.
 */
const TARGET_SAVINGS = 0.4;
const QUALITY_FLOOR = 0.45;
const QUALITY_HARD_FLOOR = 0.35;
/** Encoding iterations cap — keeps huge batches responsive. */
const MAX_SEARCH_ITERATIONS = 6;

function isLossy(format: ImageFormat): boolean {
  return format === 'jpg' || format === 'jpeg' || format === 'webp';
}

interface QualityProbe {
  blob: Blob;
  q: number;
  /** True when the returned blob meets the size target. */
  meets: boolean;
}

/**
 * Highest quality in [lo, hi] whose encode fits under `target` bytes.
 * When even `lo` does not fit, returns the `lo` encode with meets=false so
 * the caller can still use it as a best effort.
 */
async function probeQualityRange(
  encode: (q: number) => Promise<Blob>,
  lo: number,
  hi: number,
  target: number,
): Promise<QualityProbe> {
  const loBlob = await encode(lo);
  if (loBlob.size > target) return { blob: loBlob, q: lo, meets: false };
  let best = loBlob;
  let bestQ = lo;
  let low = lo;
  let high = hi;
  for (let i = 0; i < MAX_SEARCH_ITERATIONS && high - low > 0.01; i += 1) {
    const mid = (low + high) / 2;
    const trial = await encode(mid);
    if (trial.size <= target) {
      best = trial;
      bestQ = mid;
      low = mid; // push quality back UP toward the user's ceiling
    } else {
      high = mid;
    }
  }
  return { blob: best, q: bestQ, meets: true };
}

/**
 * Smart compression:
 *
 * - The quality slider is a CEILING. Lossy outputs (JPG/WebP) first encode at
 *   the ceiling; when that does not beat the original by at least
 *   TARGET_SAVINGS, a binary search finds the highest quality in
 *   [QUALITY_FLOOR, ceiling] that does — real savings at the best possible
 *   quality. `finalQuality` records what was actually used and the UI shows
 *   it, so nothing is hidden.
 * - LOSSLESS outputs (PNG): quality does not apply; the canvas re-encode is
 *   compared once against the original. When it cannot win, the original is
 *   delivered back untouched AND (if the browser can encode WebP) a much
 *   smaller WebP copy is added as an optional `suggested` result.
 * - The original file is never inflated in same-format runs, and an explicit
 *   format request always delivers the requested container.
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

    const baseName = nameOf(originalFile);
    let blob = await encode(userQuality);
    let quality = userQuality;

    if (isLossy(format)) {
      const target = originalSize * (1 - TARGET_SAVINGS);
      const softQ = Math.min(QUALITY_FLOOR, userQuality);
      if (blob.size > target && softQ < userQuality) {
        // The ceiling quality does not achieve a real reduction — search for
        // the HIGHEST quality that saves at least TARGET_SAVINGS.
        let cand = await probeQualityRange(encode, softQ, userQuality, target);
        if (!cand.meets && softQ > QUALITY_HARD_FLOOR) {
          // Wrung-out input (already ~q55-q65): extend down to the absolute
          // floor, where measured curves show real savings reappear.
          const lower = await probeQualityRange(encode, QUALITY_HARD_FLOOR, softQ, target);
          if (lower.meets || lower.blob.size < cand.blob.size) cand = lower;
        }
        if (cand.blob.size < blob.size) {
          blob = cand.blob;
          quality = cand.q;
        }
      }
      // Explicit conversion that still cannot beat the original: honour the
      // user's requested quality (they asked for the container, not savings).
      if (blob.size >= originalSize && options.format !== 'same' && quality !== userQuality) {
        blob = await encode(userQuality);
        quality = userQuality;
      }
    }

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
      // Turn the dead end into real savings: offer a WebP copy when the
      // browser can encode it and it actually beats the original. The user
      // sees both cards and picks — the format is never changed silently.
      if (supportsWebPEncode() && file.format !== 'webp') {
        const altQ = Math.min(0.8, userQuality);
        try {
          const alt = await encodeDecodedToBlob(file, 'webp', altQ);
          if (alt.size < originalSize) {
            results.push({
              blob: alt,
              format: 'webp',
              name: outputName(baseName, 'webp'),
              wasCompressed: true,
              originalSize,
              outputSize: alt.size,
              finalQuality: Math.round(altQ * 100),
              suggested: true,
              message: 'compressed-success',
            });
          }
        } catch {
          /* suggestion only — never fail the run because of it */
        }
      }
    }
  }

  return results;
}
