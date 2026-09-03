import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';
import { hasAlpha, fillBackground, clearCanvas } from '@/lib/image/transparent';

export interface ResizeOptions {
  width: number;
  height: number;
  format: ImageFormat; // output format (same as input for this tool)
}

export async function resizeImage(
  files: DecodedImage[],
  options: ResizeOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const format = options.format === 'gif' ? 'png' : options.format; // canvas can't encode GIF
  const { canvas, ctx } = createCanvas(options.width, options.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Transparency / black-background fix:
  // Always start transparent; for lossy JPEG output fill white if source has alpha.
  clearCanvas(ctx, options.width, options.height);
  const sourceHasAlpha = hasAlpha(decoded);
  const isOpaqueOutput = format === 'jpg' || format === 'jpeg';
  if (isOpaqueOutput && sourceHasAlpha) {
    fillBackground(ctx, '#ffffff', options.width, options.height);
  }

  if (decoded.bitmap) {
    ctx.drawImage(decoded.bitmap, 0, 0, options.width, options.height);
  } else {
    ctx.drawImage(decoded.image, 0, 0, options.width, options.height);
  }
  const blob = await canvasToBlob(canvas, { format, quality: 0.92 });
  return { blob, format, name: outputName(nameOf(decoded.file), format) };
}
