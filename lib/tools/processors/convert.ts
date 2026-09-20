import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, fillBackground, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob, supportsAvifEncode, supportsWebPEncode } from '@/lib/image/format';
import { hasAlpha, clearCanvas } from '@/lib/image/transparent';

export interface ConvertOptions {
  format: ImageFormat;
  quality: number; // 1..100
  background: string; // css color used when output has no alpha
}

function ensureWebP() {
  if (!supportsWebPEncode()) {
    throw new Error('webp-unsupported');
  }
}

async function ensureAvif() {
  if (!(await supportsAvifEncode())) {
    throw new Error('avif-unsupported');
  }
}

/**
 * Render a decoded image onto a square canvas with transparent padding —
 * ICO entries must be square, while source photos rarely are.
 */
function squareSource(decoded: DecodedImage): { canvas: HTMLCanvasElement; side: number } {
  const side = Math.max(1, Math.max(decoded.width, decoded.height));
  const { canvas, ctx } = createCanvas(side, side);
  clearCanvas(ctx, side, side);
  const dx = Math.round((side - decoded.width) / 2);
  const dy = Math.round((side - decoded.height) / 2);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, dx, dy, decoded.width, decoded.height);
  else ctx.drawImage(decoded.image, dx, dy, decoded.width, decoded.height);
  return { canvas, side };
}

/** Convert one image to a multi-size `.ico` file (16/32/48 + 256px). */
async function convertToIco(decoded: DecodedImage): Promise<ProcessResult> {
  const { buildIco } = await import('@/lib/image/ico');
  const { canvas: square, side } = squareSource(decoded);
  // Always ship the classic small sizes; the 256px entry only when the
  // source is big enough to deserve it (no extreme upscaling).
  const sizes = [16, 32, 48, 256].filter((s) => s <= Math.max(side, 48));
  const parts: { size: number; blob: Blob }[] = [];
  for (const size of sizes) {
    const { canvas, ctx } = createCanvas(size, size);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(square, 0, 0, size, size);
    const blob = await canvasToBlob(canvas, { format: 'png' });
    canvas.width = 0;
    canvas.height = 0;
    parts.push({ size, blob });
  }
  square.width = 0;
  square.height = 0;
  const blob = await buildIco(parts);
  return { blob, format: 'ico', name: outputName(nameOf(decoded.file), 'ico') };
}

export async function convertImage(
  files: DecodedImage[],
  options: ConvertOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const format = options.format;
  const quality = Math.max(0.01, Math.min(1, options.quality / 100));
  if (format === 'webp') ensureWebP();
  if (format === 'avif') await ensureAvif();
  if (format === 'ico') return convertToIco(decoded);

  const needsOpaque = format === 'jpg' || format === 'jpeg';
  const sourceHasAlpha = hasAlpha(decoded);
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  clearCanvas(ctx, decoded.width, decoded.height);
  if (needsOpaque && sourceHasAlpha) fillBackground(ctx, options.background || '#ffffff', decoded.width, decoded.height);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);

  const blob = await canvasToBlob(canvas, { format, quality });
  return { blob, format, name: outputName(nameOf(decoded.file), format) };
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
