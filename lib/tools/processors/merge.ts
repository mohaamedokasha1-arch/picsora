import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, fillBackground } from '@/lib/image/process';
import { encodeCanvas } from '@/lib/image/format';
import { needsOpaqueBackground } from '@/lib/image/format-support';

export interface MergeOptions {
  direction: 'horizontal' | 'vertical';
  spacing: number; // px
  background: string;
  format: ImageFormat;
}

export async function mergeImages(
  files: DecodedImage[],
  options: MergeOptions,
): Promise<ProcessResult> {
  if (files.length < 2) throw new Error('need-at-least-two');
  const maxW = Math.max(...files.map((f) => f.width));
  const maxH = Math.max(...files.map((f) => f.height));
  const n = files.length;
  const spacing = Math.max(0, Math.round(options.spacing));
  const totalSpacing = spacing * (n - 1);

  const canvasW = options.direction === 'horizontal' ? maxW * n + totalSpacing : maxW;
  const canvasH = options.direction === 'vertical' ? maxH * n + totalSpacing : maxH;

  const { canvas, ctx } = createCanvas(canvasW, canvasH);
  const needsOpaque = needsOpaqueBackground(options.format);
  if (needsOpaque) fillBackground(ctx, options.background || '#ffffff', canvasW, canvasH);

  files.forEach((file, i) => {
    const x = options.direction === 'horizontal' ? i * (maxW + spacing) : 0;
    const y = options.direction === 'vertical' ? i * (maxH + spacing) : 0;
    // Center within its cell.
    const ox = x + (maxW - file.width) / 2;
    const oy = y + (maxH - file.height) / 2;
    if (file.bitmap) ctx.drawImage(file.bitmap, ox, oy);
    else ctx.drawImage(file.image, ox, oy);
  });

  const encoded = await encodeCanvas(canvas, { format: options.format, quality: 0.92 });
  const ext = encoded.format === 'jpeg' ? 'jpg' : encoded.format;
  return {
    blob: encoded.blob,
    format: encoded.format,
    ...(encoded.fallbackFrom ? { fallbackFrom: encoded.fallbackFrom } : {}),
    name: `merged.${ext}`,
  };
}
