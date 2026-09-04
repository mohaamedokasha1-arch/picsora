import type { ToolProcessor } from './types';
import { compressImages } from './compressor';
import { resizeImage } from './resizer';
import { cropImage } from './cropper';
import { rotateImage } from './rotator';
import { flipImage } from './flip';
import { convertImage } from './convert';
import { imagesToPdf } from './pdf';
import { mergeImages } from './merge';
import { splitImage } from './split';
import { toGrayscale } from './grayscale';
import { applyWatermark } from './watermark';
import { compressToExactSize } from './exact-size';
import { removeBackground } from './background';
import { makePassportPhoto } from './passport';
import { makeSignature } from './signature';

/**
 * Maps a tool slug to its processing function.
 * The color-picker tool is interactive and reads pixels directly in the UI
 * (no batch processor) and the palette extractor is invoked via its own
 * worker bridge, so neither appears here.
 */
export const processors: Record<string, ToolProcessor<any>> = {
  'image-compressor': compressImages,
  'image-resizer': resizeImage,
  'image-cropper': cropImage,
  'image-rotator': rotateImage,
  'flip-image-horizontal': flipImage,
  'flip-image-vertical': flipImage,
  'jpg-to-png': convertImage,
  'png-to-jpg': convertImage,
  'jpg-to-webp': convertImage,
  'png-to-webp': convertImage,
  'webp-to-jpg': convertImage,
  'webp-to-png': convertImage,
  'image-to-pdf': imagesToPdf,
  'images-to-pdf': imagesToPdf,
  'merge-images': mergeImages,
  'split-image': splitImage,
  'image-to-grayscale': toGrayscale,
  'image-watermark': applyWatermark,
  'heic-to-jpg': convertImage,
  'heic-to-png': convertImage,
  'image-to-exact-kb': compressToExactSize,
  'background-remover': removeBackground,
  'passport-photo-maker': makePassportPhoto,
  'signature-maker': makeSignature,
};

export * from './types';
