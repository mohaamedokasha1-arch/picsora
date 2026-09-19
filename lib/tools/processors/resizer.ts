import type { DecodedImage, ImageFormat, ProcessResult } from '@/lib/types';
import { createCanvas, nameOf, outputName } from '@/lib/image/process';
import { canvasToBlob, encodableFormat } from '@/lib/image/format';
import { hasAlpha, fillBackground, clearCanvas } from '@/lib/image/transparent';

export interface ResizePreset {
  id: string;
  width: number;
  height: number;
  /** i18n key for the preset label (platform names stay in Latin script). */
  labelKey: string;
}

/**
 * Data-driven social-media size presets. Dimensions follow each platform's
 * published recommendations; adding a network is one line here plus two
 * label strings (en/ar) — no UI changes needed.
 */
export const SOCIAL_PRESETS: ResizePreset[] = [
  { id: 'instagram-post', width: 1080, height: 1350, labelKey: 'socialPresets.instagramPost' },
  { id: 'instagram-square', width: 1080, height: 1080, labelKey: 'socialPresets.instagramSquare' },
  { id: 'instagram-story', width: 1080, height: 1920, labelKey: 'socialPresets.instagramStory' },
  { id: 'facebook-post', width: 1200, height: 630, labelKey: 'socialPresets.facebookPost' },
  { id: 'facebook-cover', width: 820, height: 312, labelKey: 'socialPresets.facebookCover' },
  { id: 'youtube-thumbnail', width: 1280, height: 720, labelKey: 'socialPresets.youtubeThumbnail' },
  { id: 'youtube-banner', width: 2560, height: 1440, labelKey: 'socialPresets.youtubeBanner' },
  { id: 'linkedin-post', width: 1200, height: 627, labelKey: 'socialPresets.linkedinPost' },
  { id: 'linkedin-banner', width: 1584, height: 396, labelKey: 'socialPresets.linkedinBanner' },
  { id: 'x-post', width: 1200, height: 675, labelKey: 'socialPresets.xPost' },
  { id: 'pinterest-pin', width: 1000, height: 1500, labelKey: 'socialPresets.pinterestPin' },
];

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
  const isOpaqueOutput = format === 'jpg' || format === 'jpeg';
  if (isOpaqueOutput && sourceHasAlpha) {
    fillBackground(ctx, '#ffffff', options.width, options.height);
  }

  if (decoded.bitmap) {
    ctx.drawImage(decoded.bitmap, 0, 0, options.width, options.height);
  } else {
    ctx.drawImage(decoded.image, 0, 0, options.width, options.height);
  }
  const blob = await canvasToBlob(canvas, { format, quality: 0.92 });
  return { blob, format, name: outputName(nameOf(decoded.file), format) };
}
