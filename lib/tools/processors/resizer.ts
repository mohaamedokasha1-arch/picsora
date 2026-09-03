import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';

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
  if (decoded.bitmap) {
    ctx.drawImage(decoded.bitmap, 0, 0, options.width, options.height);
  } else {
    ctx.drawImage(decoded.image, 0, 0, options.width, options.height);
  }
  const blob = await canvasToBlob(canvas, { format, quality: 0.92 });
  return { blob, format, name: outputName(nameOf(decoded.file), format) };
}
