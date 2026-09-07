import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { encodableFormat, encodeCanvas } from '@/lib/image/format';
import { hasAlpha, fillBackground, clearCanvas } from '@/lib/image/transparent';
import { needsOpaqueBackground } from '@/lib/image/format-support';

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
  // Flatten decision is made against the container that will really be
  // written, so a request that safely falls back to PNG keeps its transparency
  // and a request that becomes JPEG gets the white background it needs.
  const target = encodableFormat(options.format);
  const { canvas, ctx } = createCanvas(options.width, options.height);
  clearCanvas(ctx, options.width, options.height);
  const sourceHasAlpha = hasAlpha(decoded);
  const isOpaqueOutput = needsOpaqueBackground(target);
  if (isOpaqueOutput && sourceHasAlpha) {
    fillBackground(ctx, '#ffffff', options.width, options.height);
  }
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
  const encoded = await encodeCanvas(canvas, { format: options.format, quality: 0.92 });
  return {
    blob: encoded.blob,
    format: encoded.format,
    ...(encoded.fallbackFrom ? { fallbackFrom: encoded.fallbackFrom } : {}),
    name: outputName(nameOf(decoded.file), encoded.format),
  };
}
