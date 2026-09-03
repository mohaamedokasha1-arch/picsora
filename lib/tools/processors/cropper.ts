import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';

export interface CropOptions {
  x: number; // natural-image pixel coordinates
  y: number;
  width: number;
  height: number;
  format: ImageFormat;
}

export async function cropImage(
  files: DecodedImage[],
  options: CropOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const { canvas, ctx } = createCanvas(options.width, options.height);
  if (decoded.bitmap) {
    ctx.drawImage(
      decoded.bitmap,
      options.x,
      options.y,
      options.width,
      options.height,
      0,
      0,
      options.width,
      options.height,
    );
  } else {
    ctx.drawImage(
      decoded.image,
      options.x,
      options.y,
      options.width,
      options.height,
      0,
      0,
      options.width,
      options.height,
    );
  }
  const blob = await canvasToBlob(canvas, { format: options.format, quality: 0.92 });
  return { blob, format: options.format, name: outputName(nameOf(decoded.file), options.format) };
}
