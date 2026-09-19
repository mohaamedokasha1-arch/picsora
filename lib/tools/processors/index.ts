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
import { adjustImage, applyFilterEffect, blurImage, pixelateImage, roundCorners } from './effects';
import { makeFavicon } from './favicon';
import { upscaleImage } from './upscale';

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
  'image-blur': blurImage,
  'image-pixelate': pixelateImage,
  'brightness-contrast': adjustImage,
  'image-filters': applyFilterEffect,
  'rounded-corners': roundCorners,
  'heic-to-jpg': convertImage,
  'heic-to-png': convertImage,
  'image-to-exact-kb': compressToExactSize,
  'background-remover': removeBackground,
  'passport-photo-maker': makePassportPhoto,
  'signature-maker': makeSignature,
  'avif-to-jpg': convertImage,
  'avif-to-png': convertImage,
  'avif-to-webp': convertImage,
  'jpg-to-avif': convertImage,
  'png-to-avif': convertImage,
  'webp-to-avif': convertImage,
  'svg-to-png': convertImage,
  'svg-to-jpg': convertImage,
  'svg-to-webp': convertImage,
  'gif-to-webp': convertImage,
  'image-to-ico': convertImage,
  'ico-to-png': convertImage,
  'compress-image-to-100kb': compressToExactSize,
  'compress-image-to-200kb': compressToExactSize,
  'compress-image-to-500kb': compressToExactSize,
  'compress-image-to-1mb': compressToExactSize,
  'favicon-generator': makeFavicon,
  'image-upscaler': upscaleImage,
};

export * from './types';
