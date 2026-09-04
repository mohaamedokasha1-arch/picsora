import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, fillBackground } from '@/lib/image/process';
import { canvasToBlob, encodableFormat } from '@/lib/image/format';

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
  const needsOpaque = options.format === 'jpg' || options.format === 'jpeg';
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

  const format = encodableFormat(options.format);
  const blob = await canvasToBlob(canvas, { format, quality: 0.92 });
  return { blob, format, name: `merged.${format === 'jpeg' ? 'jpg' : format}` };
}
