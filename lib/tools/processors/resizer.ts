import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { encodableFormat, encodeCanvas } from '@/lib/image/format';
import { hasAlpha, fillBackground, clearCanvas } from '@/lib/image/transparent';
import { needsOpaqueBackground } from '@/lib/image/format-support';

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
  const format = encodableFormat(options.format); // canvas can't encode GIF/HEIC
  const { canvas, ctx } = createCanvas(options.width, options.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Transparency / black-background fix:
  // Always start transparent; for lossy JPEG output fill white if source has alpha.
  clearCanvas(ctx, options.width, options.height);
  const sourceHasAlpha = hasAlpha(decoded);
  const isOpaqueOutput = needsOpaqueBackground(format);
  if (isOpaqueOutput && sourceHasAlpha) {
    fillBackground(ctx, '#ffffff', options.width, options.height);
  }

  if (decoded.bitmap) {
    ctx.drawImage(decoded.bitmap, 0, 0, options.width, options.height);
  } else {
    ctx.drawImage(decoded.image, 0, 0, options.width, options.height);
  }
  // The encoder is handed the ORIGINAL request and reports the container it
  // really wrote, so the name/MIME always match the bytes (a browser without a
  // WebP encoder gets a valid .png plus a `fallbackFrom` note, never a broken
  // file and never a crash).
  const encoded = await encodeCanvas(canvas, { format: options.format, quality: 0.92 });
  return {
    blob: encoded.blob,
    format: encoded.format,
    ...(encoded.fallbackFrom ? { fallbackFrom: encoded.fallbackFrom } : {}),
    name: outputName(nameOf(decoded.file), encoded.format),
  };
}
