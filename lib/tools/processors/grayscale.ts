import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';

export interface GrayscaleOptions {
  format: ImageFormat;
}

export async function toGrayscale(
  files: DecodedImage[],
  options: GrayscaleOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);

  const imageData = ctx.getImageData(0, 0, decoded.width, decoded.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
  }
  ctx.putImageData(imageData, 0, 0);

  const blob = await canvasToBlob(canvas, { format: options.format, quality: 0.92 });
  return { blob, format: options.format, name: outputName(nameOf(decoded.file), options.format) };
}
