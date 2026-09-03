import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob, decodeImage } from '@/lib/image/format';

export type WatermarkPosition =
  | 'tl' | 'tc' | 'tr'
  | 'ml' | 'c' | 'mr'
  | 'bl' | 'bc' | 'br';

export interface WatermarkOptions {
  type: 'text' | 'image';
  text: string;
  fontFamily: string;
  fontSize: number; // px (text)
  color: string; // css color (text)
  opacity: number; // 1..100
  position: WatermarkPosition;
  tile: boolean;
  format: ImageFormat;
  watermarkFile?: File; // for image watermark
  watermarkScale: number; // 5..100 (% of base width)
}

function positionPoint(
  position: WatermarkPosition,
  canvasW: number,
  canvasH: number,
  itemW: number,
  itemH: number,
  margin: number,
): { x: number; y: number } {
  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const left = margin;
  const right = canvasW - itemW - margin;
  const top = margin;
  const bottom = canvasH - itemH - margin;
  const midX = cx - itemW / 2;
  const midY = cy - itemH / 2;
  switch (position) {
    case 'tl': return { x: left, y: top };
    case 'tc': return { x: midX, y: top };
    case 'tr': return { x: right, y: top };
    case 'ml': return { x: left, y: midY };
    case 'c': return { x: midX, y: midY };
    case 'mr': return { x: right, y: midY };
    case 'bl': return { x: left, y: bottom };
    case 'bc': return { x: midX, y: bottom };
    case 'br': return { x: right, y: bottom };
    default: return { x: midX, y: midY };
  }
}

export async function applyWatermark(
  files: DecodedImage[],
  options: WatermarkOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);

  const opacity = Math.max(0, Math.min(1, options.opacity / 100));
  ctx.globalAlpha = opacity;
  const margin = Math.max(8, Math.round(decoded.width * 0.03));

  if (options.type === 'text') {
    const text = options.text || '©';
    const size = Math.max(6, Math.round(options.fontSize));
    ctx.font = `${size}px ${options.fontFamily || 'sans-serif'}`;
    ctx.fillStyle = options.color || '#ffffff';
    ctx.textBaseline = 'top';
    const tw = ctx.measureText(text).width;
    const th = size;

    if (options.tile) {
      const stepX = tw + Math.max(24, tw * 0.8);
      const stepY = th + Math.max(24, th * 0.8);
      for (let y = margin; y < decoded.height; y += stepY) {
        for (let x = margin; x < decoded.width; x += stepX) {
          ctx.fillText(text, x, y);
        }
      }
    } else {
      const { x, y } = positionPoint(options.position, decoded.width, decoded.height, tw, th, margin);
      ctx.fillText(text, x, y);
    }
  } else {
    if (!options.watermarkFile) throw new Error('no-watermark');
    const wm = await decodeImage(options.watermarkFile);
    const scale = Math.max(0.05, Math.min(1, options.watermarkScale / 100));
    const ww = Math.max(16, Math.round(decoded.width * scale));
    const wh = Math.max(16, Math.round(ww * (wm.height / wm.width)));
    const src = wm.bitmap ?? wm.image;

    if (options.tile) {
      const stepX = ww + Math.max(24, ww * 0.6);
      const stepY = wh + Math.max(24, wh * 0.6);
      for (let y = margin; y < decoded.height; y += stepY) {
        for (let x = margin; x < decoded.width; x += stepX) {
          ctx.drawImage(src as CanvasImageSource, x, y, ww, wh);
        }
      }
    } else {
      const { x, y } = positionPoint(options.position, decoded.width, decoded.height, ww, wh, margin);
      ctx.drawImage(src as CanvasImageSource, x, y, ww, wh);
    }
    wm.bitmap?.close();
  }

  ctx.globalAlpha = 1;
  const blob = await canvasToBlob(canvas, { format: options.format, quality: 0.92 });
  return { blob, format: options.format, name: outputName(nameOf(decoded.file), options.format) };
}
