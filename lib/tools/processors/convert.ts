import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, fillBackground, nameOf, outputName } from '@/lib/image/process';
import { encodableFormat, encodeCanvas } from '@/lib/image/format';
import { hasAlpha, clearCanvas } from '@/lib/image/transparent';
import { needsOpaqueBackground } from '@/lib/image/format-support';

export interface ConvertOptions {
  format: ImageFormat;
  quality: number; // 1..100
  background: string; // css color used when output has no alpha
}

/**
 * Convert an image to another container.
 *
 * Format safety: the requested container is passed through the capability
 * layer (`encodableFormat`), so a browser without a WebP encoder no longer
 * aborts the tool — it writes PNG (alpha preserved, correct extension) and
 * reports `fallbackFrom: 'webp'` so the UI can explain the switch. The file is
 * never named after bytes the browser did not produce, which is what used to
 * happen when `toBlob` silently answered with PNG for an unsupported type.
 */
export async function convertImage(
  files: DecodedImage[],
  options: ConvertOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const requested = options.format;
  // Decide the flattening background against the container we will really
  // write, not the one that was asked for (a WebP request that falls back to
  // PNG must keep its transparency; a HEIC request that becomes JPEG must be
  // painted white first).
  const target = encodableFormat(requested);
  const quality = Math.max(0.01, Math.min(1, options.quality / 100));

  const needsOpaque = needsOpaqueBackground(target);
  const sourceHasAlpha = hasAlpha(decoded);
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  clearCanvas(ctx, decoded.width, decoded.height);
  if (needsOpaque && sourceHasAlpha) fillBackground(ctx, options.background || '#ffffff', decoded.width, decoded.height);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);

  const encoded = await encodeCanvas(canvas, { format: requested, quality });
  const outFormat = encoded.format;
  return {
    blob: encoded.blob,
    format: outFormat,
    ...(encoded.fallbackFrom ? { fallbackFrom: encoded.fallbackFrom } : {}),
    name: outputName(nameOf(decoded.file), outFormat),
  };
}

export async function convertMany(
  files: DecodedImage[],
  options: ConvertOptions,
): Promise<ProcessResult[]> {
  const out: ProcessResult[] = [];
  for (const file of files) {
    const r = await convertImage([file], options);
    // Per-file source size keeps the result card's comparison honest for
    // multi-image batches.
    out.push({ ...r, originalSize: file.file.size });
  }
  return out;
}
