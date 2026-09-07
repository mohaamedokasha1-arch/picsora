import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { encodeCanvas } from '@/lib/image/format';

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
  const encoded = await encodeCanvas(canvas, { format: options.format, quality: 0.92 });
  return {
    blob: encoded.blob,
    format: encoded.format,
    ...(encoded.fallbackFrom ? { fallbackFrom: encoded.fallbackFrom } : {}),
    name: outputName(nameOf(decoded.file), encoded.format),
  };
}
