import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, fillBackground, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob, supportsWebPEncode } from '@/lib/image/format';
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

export async function convertImage(
  files: DecodedImage[],
  options: ConvertOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const format = options.format;
  const quality = Math.max(0.01, Math.min(1, options.quality / 100));
  if (format === 'webp') ensureWebP();

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
  for (const file of files) out.push(await convertImage([file], options));
  return out;
}
