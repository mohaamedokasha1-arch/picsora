import type { DecodedImage, ProcessResult } from '@/lib/types';
import { nameOf } from '@/lib/image/process';
import { canvasToBlob, supportsWebPEncode } from '@/lib/image/format';

export interface PassportPreset {
  id: string;
  wMm: number;
  hMm: number;
}

export const PASSPORT_PRESETS: PassportPreset[] = [
  { id: '35x45', wMm: 35, hMm: 45 },
  { id: '30x40', wMm: 30, hMm: 40 },
  { id: '33x48', wMm: 33, hMm: 48 },
  { id: '50x50', wMm: 50.8, hMm: 50.8 },
  { id: '40x60', wMm: 40, hMm: 60 },
];

export interface PassportOptions {
  presetId: string;
  dpi: 300 | 600;
  background: string;
  format: 'jpg' | 'png';
}

export interface PassportResult extends ProcessResult {
  width: number;
  height: number;
}

/**
 * Build an ID / passport photo: centre cover-crop to the exact aspect ratio,
 * then render at print resolution (mm → px via DPI). Fully local.
 */
export async function makePassportPhoto(
  files: DecodedImage[],
  options: PassportOptions,
): Promise<PassportResult[]> {
  const decoded = files[0];
  const preset = PASSPORT_PRESETS.find((p) => p.id === options.presetId) ?? PASSPORT_PRESETS[0];
  const targetW = Math.round((preset.wMm / 25.4) * options.dpi);
  const targetH = Math.round((preset.hMm / 25.4) * options.dpi);

  const srcAspect = decoded.width / decoded.height;
  const dstAspect = targetW / targetH;
  let sx = 0;
  let sy = 0;
  let sw = decoded.width;
  let sh = decoded.height;
  if (srcAspect > dstAspect) {
    sw = Math.round(decoded.height * dstAspect);
    sx = Math.round((decoded.width - sw) / 2);
  } else {
    sh = Math.round(decoded.width / dstAspect);
    sy = Math.round((decoded.height - sh) / 2);
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no-2d-context');
  if (options.format === 'jpg') {
    ctx.fillStyle = options.background || '#ffffff';
    ctx.fillRect(0, 0, targetW, targetH);
  }
  ctx.drawImage(
    (decoded.bitmap ?? decoded.image) as CanvasImageSource,
    sx,
    sy,
    sw,
    sh,
    0,
    0,
    targetW,
    targetH,
  );

  if (options.format === 'jpg') {
    void supportsWebPEncode;
  }
  const blob = await canvasToBlob(canvas, {
    format: options.format,
    quality: 0.92,
  });
  canvas.width = 0;
  canvas.height = 0;
  const ext = options.format;
  return [
    {
      blob,
      format: ext,
      name: `${nameOf(decoded.file)}-passport-${preset.id}.${ext}`,
      width: targetW,
      height: targetH,
    },
  ];
}
