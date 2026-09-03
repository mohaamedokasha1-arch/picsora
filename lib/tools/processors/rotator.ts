import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';
import { hasAlpha, fillBackground, clearCanvas } from '@/lib/image/transparent';

export interface RotateOptions {
  angle: number; // degrees 0..360
  format: ImageFormat;
}

function drawRotated(
  ctx: CanvasRenderingContext2D,
  src: CanvasImageSource,
  sw: number,
  sh: number,
  angle: number,
) {
  const rad = (angle * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const nw = Math.round(sw * cos + sh * sin);
  const nh = Math.round(sw * sin + sh * cos);
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return { nw, nh };
}

export async function rotateImage(
  files: DecodedImage[],
  options: RotateOptions,
): Promise<ProcessResult> {
  const decoded = files[0];
  const src = decoded.bitmap ?? decoded.image;
  const sw = decoded.width;
  const sh = decoded.height;
  const angle = ((options.angle % 360) + 360) % 360;
  const lossless = angle === 90 || angle === 180 || angle === 270;
  const isJpg = options.format === 'jpg' || options.format === 'jpeg';

  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  const sourceHasAlpha = hasAlpha(decoded);

  if (lossless) {
    const swap = angle === 90 || angle === 270;
    const { canvas: c, ctx: cctx } = createCanvas(swap ? sh : sw, swap ? sw : sh);
    canvas = c;
    ctx = cctx;
    clearCanvas(ctx, canvas.width, canvas.height);
    if (isJpg && sourceHasAlpha) fillBackground(ctx, '#ffffff', canvas.width, canvas.height);
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(src as CanvasImageSource, -sw / 2, -sh / 2, sw, sh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  } else {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const nw = Math.round(sw * cos + sh * sin);
    const nh = Math.round(sw * sin + sh * cos);
    const box = createCanvas(nw, nh);
    canvas = box.canvas;
    ctx = box.ctx;
    clearCanvas(ctx, nw, nh);
    if (isJpg && sourceHasAlpha) fillBackground(ctx, '#ffffff', nw, nh);
    drawRotated(ctx, src as CanvasImageSource, sw, sh, angle);
  }

  const blob = await canvasToBlob(canvas, { format: options.format, quality: 0.92 });
  return { blob, format: options.format, name: outputName(nameOf(decoded.file), options.format) };
}
