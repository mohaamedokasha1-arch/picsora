import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';
import { hasAlpha } from '@/lib/image/transparent';

export interface UpscaleOptions {
  /** Integer scale factor (2 or 4). */
  scale: 2 | 4;
  format: ImageFormat;
  quality: number; // 1..100 for lossy outputs
  background: string;
}

/**
 * Enlarge an image 2×/4× with stepped high-quality resampling. This is
 * honest interpolation (progressive 2× steps with high smoothing quality) —
 * it preserves edges far better than a single naive stretch, but it cannot
 * invent detail like a trained AI model, and the UI says so.
 */
export async function upscaleImage(
  files: DecodedImage[],
  options: UpscaleOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const scale = options.scale === 4 ? 4 : 2;
  const targetW = decoded.width * scale;
  const targetH = decoded.height * scale;
  if (targetW > 16000 || targetH > 16000 || targetW * targetH > 100_000_000) {
    throw new Error('image-too-large');
  }

  // Progressive doubling preserves edges better than one giant stretch.
  let current: HTMLCanvasElement | ImageBitmap | HTMLImageElement = decoded.bitmap ?? decoded.image;
  let w = decoded.width;
  let h = decoded.height;
  let steps = scale === 4 ? 2 : 1;
  const intermediates: HTMLCanvasElement[] = [];
  try {
    while (steps > 0) {
      const nw = Math.round(w * 2);
      const nh = Math.round(h * 2);
      const { canvas, ctx } = createCanvas(nw, nh);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(current as CanvasImageSource, 0, 0, nw, nh);
      intermediates.push(canvas);
      current = canvas;
      w = nw;
      h = nh;
      steps -= 1;
    }

    const format = options.format;
    const needsOpaque = format === 'jpg' || format === 'jpeg';
    const { canvas: out, ctx } = createCanvas(w, h);
    if (needsOpaque && hasAlpha(decoded)) {
      ctx.fillStyle = options.background || '#ffffff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(current as CanvasImageSource, 0, 0);
    const blob = await canvasToBlob(out, {
      format,
      quality: Math.max(0.01, Math.min(1, options.quality / 100)),
    });
    out.width = 0;
    out.height = 0;
    return {
      blob,
      format,
      name: outputName(`${nameOf(decoded.file)}-${scale}x`, format),
      originalSize: decoded.file.size,
    };
  } finally {
    for (const c of intermediates) {
      c.width = 0;
      c.height = 0;
    }
  }
}
