import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { canvasToBlob, encodableFormat } from '@/lib/image/format';
import { createCanvas, nameOf, outputName, sourceOf } from '@/lib/image/process';
import { hasAlpha } from '@/lib/image/transparent';
import {
  assertUpscalableSize,
  upscaleRgba,
  type ModelIoHandler,
  type Tf,
  type UpscaleFactor,
  type UpscaleProgress,
} from '@/lib/ai/upscaler';

/** `same` keeps the input format (HEIC/GIF fall back to JPG/PNG). */
export type UpscaleFormat = 'same' | 'png' | 'jpg' | 'webp';

export interface UpscalerOptions {
  scale: UpscaleFactor;
  format?: UpscaleFormat;
  onProgress?: (progress: UpscaleProgress) => void;
  /** Test seams, forwarded verbatim to the TensorFlow.js runtime. */
  tf?: Tf;
  ioHandler?: ModelIoHandler;
}

function resolveFormat(requested: UpscaleFormat, source: ImageFormat): ImageFormat {
  if (requested === 'same') return encodableFormat(source);
  return encodableFormat(requested);
}

/**
 * AI super-resolution for one image, entirely on the visitor's device.
 *
 * Pipeline: decode → read RGBA at native size → ESRGAN (TensorFlow.js, tiled)
 * → recompose with the (bicubic-upscaled) alpha plane when the source has
 * transparency → encode. Throws `upscaler-too-large` before any heavy work
 * when the upscaled bitmap would exceed the in-browser canvas limits.
 */
export async function upscaleImage(files: DecodedImage[], options: UpscalerOptions): Promise<ProcessResult> {
  const decoded = files[0];
  if (!decoded) throw new Error('decode-failed');

  const { width, height } = decoded;
  assertUpscalableSize(width, height, options.scale, decoded.file.name);

  const outW = width * options.scale;
  const outH = height * options.scale;
  const format = resolveFormat(options.format ?? 'same', decoded.format);
  const opaqueOutput = format === 'jpg' || format === 'jpeg';
  const transparentSource = hasAlpha(decoded);

  // 1 ── read the source pixels at native resolution (EXIF already applied by decodeImage).
  const src = createCanvas(width, height);
  src.ctx.drawImage(sourceOf(decoded) as CanvasImageSource, 0, 0);
  const sourcePixels = src.ctx.getImageData(0, 0, width, height);
  src.canvas.width = 0;
  src.canvas.height = 0;

  // 2 ── run the neural network.
  const run = await upscaleRgba(sourcePixels.data, width, height, {
    scale: options.scale,
    onProgress: options.onProgress,
    tf: options.tf,
    ioHandler: options.ioHandler,
  });

  // 3 ── alpha: the network is RGB-only, so transparency is upscaled with the
  //       browser's own high-quality resampler and re-attached.
  let alpha: Uint8ClampedArray | null = null;
  if (transparentSource) {
    const alphaCanvas = createCanvas(outW, outH);
    alphaCanvas.ctx.imageSmoothingEnabled = true;
    alphaCanvas.ctx.imageSmoothingQuality = 'high';
    alphaCanvas.ctx.drawImage(sourceOf(decoded) as CanvasImageSource, 0, 0, outW, outH);
    alpha = alphaCanvas.ctx.getImageData(0, 0, outW, outH).data;
    alphaCanvas.canvas.width = 0;
    alphaCanvas.canvas.height = 0;
  }

  // 4 ── compose the final bitmap.
  const out = createCanvas(outW, outH);
  const imageData = out.ctx.createImageData(outW, outH);
  const pixels = imageData.data;
  const rgb = run.data;
  for (let i = 0, p = 0; i < outW * outH; i += 1, p += 4) {
    let r = rgb[p];
    let g = rgb[p + 1];
    let b = rgb[p + 2];
    let a = alpha ? alpha[p + 3] : 255;
    if (opaqueOutput) {
      // JPEG has no alpha: flatten onto white instead of letting it collapse to black.
      const k = a / 255;
      r = r * k + 255 * (1 - k);
      g = g * k + 255 * (1 - k);
      b = b * k + 255 * (1 - k);
      a = 255;
    }
    pixels[p] = r;
    pixels[p + 1] = g;
    pixels[p + 2] = b;
    pixels[p + 3] = a;
  }
  out.ctx.putImageData(imageData, 0, 0);

  const blob = await canvasToBlob(out.canvas, { format, quality: 0.95 });
  out.canvas.width = 0;
  out.canvas.height = 0;

  const base = nameOf(decoded.file);
  return {
    blob,
    format,
    name: outputName(`${base}-${options.scale}x`, format),
    originalSize: decoded.file.size,
  };
}
