import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';

export type ToolUIProps = { ctx: WorkspaceContext };
export type ToolUIComponent = ComponentType<ToolUIProps>;

/**
 * Per-tool UI registry with code splitting — each tool's interactive
 * component is loaded only when its page is visited.
 */
export const toolComponents: Record<string, ToolUIComponent> = {
  'image-compressor': dynamic(() => import('./compressor')),
  'exact-kb-image-compressor': dynamic(() => import('./exact-kb-compressor').then((m) => m.ExactKbCompressorUI)),
  'image-resizer': dynamic(() => import('./resizer')),
  'image-cropper': dynamic(() => import('./cropper')),
  'image-rotator': dynamic(() => import('./rotator')),
  'flip-image-horizontal': dynamic(() => import('./flip').then((m) => m.FlipHorizontalTool)),
  'flip-image-vertical': dynamic(() => import('./flip').then((m) => m.FlipVerticalTool)),
  'jpg-to-png': dynamic(() => import('./converter').then((m) => m.JpgToPngTool)),
  'png-to-jpg': dynamic(() => import('./converter').then((m) => m.PngToJpgTool)),
  'jpg-to-webp': dynamic(() => import('./converter').then((m) => m.JpgToWebpTool)),
  'png-to-webp': dynamic(() => import('./converter').then((m) => m.PngToWebpTool)),
  'webp-to-jpg': dynamic(() => import('./converter').then((m) => m.WebpToJpgTool)),
  'webp-to-png': dynamic(() => import('./converter').then((m) => m.WebpToPngTool)),
  'heic-to-jpg': dynamic(() => import('./converter').then((m) => m.HeicToJpgTool)),
  'heic-to-png': dynamic(() => import('./converter').then((m) => m.HeicToPngTool)),
  'heif-to-jpg': dynamic(() => import('./converter').then((m) => m.HeifToJpgTool)),
  'heif-to-png': dynamic(() => import('./converter').then((m) => m.HeifToPngTool)),
  'image-to-pdf': dynamic(() => import('./pdf-tools').then((m) => m.ImageToPdfTool)),
  'images-to-pdf': dynamic(() => import('./pdf-tools').then((m) => m.ImagesToPdfTool)),
  'merge-images': dynamic(() => import('./merge')),
  'split-image': dynamic(() => import('./split')),
  'image-color-picker': dynamic(() => import('./color-picker')),
  'color-palette-extractor': dynamic(() => import('./palette')),
  'image-to-grayscale': dynamic(() => import('./grayscale')),
  'image-watermark': dynamic(() => import('./watermark')),
  'passport-photo-maker': dynamic(() => import('./passport-photo-maker').then((m) => m.PassportPhotoMakerUI)),
};
