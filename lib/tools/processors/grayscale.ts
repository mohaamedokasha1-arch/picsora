import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName, readPixelsSafely } from '@/lib/image/process';
import { encodeCanvas } from '@/lib/image/format';

export interface GrayscaleOptions {
  format: ImageFormat;
}

/**
 * Desaturate an image (luma weights match Rec. 601, the canvas standard).
 *
 * The pixel read is guarded because it is the step that can fail outright on a
 * low-memory device with a large photo, and the output container/format is
 * taken from what the encoder actually wrote rather than from the request, so
 * the delivered file always matches its own bytes.
 */
export async function toGrayscale(
  files: DecodedImage[],
  options: GrayscaleOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);

  const imageData = readPixelsSafely(ctx, decoded.width, decoded.height, decoded.file?.name);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = lum;
    data[i + 1] = lum;
    data[i + 2] = lum;
  }
  ctx.putImageData(imageData, 0, 0);

  const encoded = await encodeCanvas(canvas, { format: options.format, quality: 0.92 });
  return {
    blob: encoded.blob,
    format: encoded.format,
    ...(encoded.fallbackFrom ? { fallbackFrom: encoded.fallbackFrom } : {}),
    name: outputName(nameOf(decoded.file), encoded.format),
  };
}
