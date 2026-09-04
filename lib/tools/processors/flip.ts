import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob, encodableFormat } from '@/lib/image/format';

export interface FlipOptions {
  direction: 'horizontal' | 'vertical';
  format: ImageFormat;
}

export async function flipImage(
  files: DecodedImage[],
  options: FlipOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  if (options.direction === 'horizontal') {
    ctx.translate(decoded.width, 0);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(0, decoded.height);
    ctx.scale(1, -1);
  }
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const format = encodableFormat(options.format);
  const blob = await canvasToBlob(canvas, { format, quality: 0.92 });
  return { blob, format, name: outputName(nameOf(decoded.file), format) };
}
