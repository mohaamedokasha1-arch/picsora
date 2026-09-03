import type { ImageFormat, OutputFormat } from '@/lib/types';

export type CategorySlug = 'compress' | 'resize' | 'convert' | 'edit' | 'pdf' | 'color';

export interface CategoryDef {
  slug: CategorySlug;
  nameKey: string; // categoryMeta.<slug>.name
  descriptionKey: string; // categoryMeta.<slug>.description
  introKey: string; // categoryIntros.<slug>
  icon: string;
}

export interface ToolFaq {
  q: string;
  a: string;
}

export interface ToolDef {
  slug: string;
  nameKey: string;
  shortKey: string;
  descriptionKey: string;
  introKey: string;
  howToKey: string;
  faqsKey: string;
  category: CategorySlug;
  icon: string;
  keywords: string[];
  inputFormats: ImageFormat[];
  outputFormats: OutputFormat[];
  maxFileSizeMB: number;
  maxFiles: number;
  relatedTools: string[];
  popular?: boolean;
}

export const CATEGORIES: CategoryDef[] = [
  { slug: 'compress', nameKey: 'categoryMeta.compress.name', descriptionKey: 'categoryMeta.compress.description', introKey: 'categoryIntros.compress', icon: 'gauge' },
  { slug: 'resize', nameKey: 'categoryMeta.resize.name', descriptionKey: 'categoryMeta.resize.description', introKey: 'categoryIntros.resize', icon: 'scaling' },
  { slug: 'convert', nameKey: 'categoryMeta.convert.name', descriptionKey: 'categoryMeta.convert.description', introKey: 'categoryIntros.convert', icon: 'repeat' },
  { slug: 'edit', nameKey: 'categoryMeta.edit.name', descriptionKey: 'categoryMeta.edit.description', introKey: 'categoryIntros.edit', icon: 'pencil' },
  { slug: 'pdf', nameKey: 'categoryMeta.pdf.name', descriptionKey: 'categoryMeta.pdf.description', introKey: 'categoryIntros.pdf', icon: 'file-text' },
  { slug: 'color', nameKey: 'categoryMeta.color.name', descriptionKey: 'categoryMeta.color.description', introKey: 'categoryIntros.color', icon: 'palette' },
];

const T = (
  slug: string,
  category: CategorySlug,
  icon: string,
  keywords: string[],
  inputFormats: ImageFormat[],
  outputFormats: OutputFormat[],
  relatedTools: string[],
  popular = false,
  maxFiles = 1,
): ToolDef => ({
  slug,
  nameKey: `tools.${slug}.name`,
  shortKey: `tools.${slug}.short`,
  descriptionKey: `tools.${slug}.description`,
  introKey: `tools.${slug}.intro`,
  howToKey: `tools.${slug}.howTo`,
  faqsKey: `tools.${slug}.faqs`,
  category,
  icon,
  keywords,
  inputFormats,
  outputFormats,
  maxFileSizeMB: 50,
  maxFiles,
  relatedTools,
  popular,
});

export const TOOLS: ToolDef[] = [
  T('image-compressor', 'compress', 'gauge', ['compress', 'reduce size', 'optimize', 'shrink', 'jpg compress', 'png compress', 'webp compress', 'ضغط الصور'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['image-resizer', 'jpg-to-webp', 'png-to-jpg', 'image-to-grayscale'], true, 20),
  T('image-resizer', 'resize', 'scaling', ['resize', 'dimensions', 'pixels', 'scale', 'width', 'height', 'تغيير الحجم'], ['jpg', 'png', 'webp', 'gif'], ['jpg', 'png', 'webp', 'gif'], ['image-compressor', 'image-cropper', 'image-rotator'], true, 1),
  T('image-cropper', 'edit', 'crop', ['crop', 'cut', 'aspect ratio', 'trim', 'قص'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['image-resizer', 'image-rotator', 'split-image'], true, 1),
  T('image-rotator', 'edit', 'rotate', ['rotate', 'turn', '90 degrees', '180', 'angle', 'تدوير'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['flip-image-horizontal', 'flip-image-vertical', 'image-cropper'], false, 1),
  T('flip-image-horizontal', 'edit', 'flip-horizontal', ['flip', 'mirror', 'horizontal', 'reflect', 'انعكاس'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['flip-image-vertical', 'image-rotator', 'image-cropper'], false, 1),
  T('flip-image-vertical', 'edit', 'flip-vertical', ['flip', 'mirror', 'vertical', 'upside down', 'انعكاس'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['flip-image-horizontal', 'image-rotator', 'image-cropper'], false, 1),
  T('jpg-to-png', 'convert', 'repeat', ['jpg to png', 'jpeg to png', 'convert jpg', 'jpg2png', 'تحويل'], ['jpg'], ['png'], ['png-to-jpg', 'jpg-to-webp', 'image-compressor'], true, 10),
  T('png-to-jpg', 'convert', 'repeat', ['png to jpg', 'convert png', 'png2jpg', 'transparent to white', 'تحويل'], ['png'], ['jpg'], ['jpg-to-png', 'png-to-webp', 'webp-to-jpg'], true, 10),
  T('jpg-to-webp', 'convert', 'repeat', ['jpg to webp', 'convert to webp', 'jpeg webp', 'تحويل'], ['jpg'], ['webp'], ['png-to-webp', 'webp-to-jpg', 'image-compressor'], false, 10),
  T('png-to-webp', 'convert', 'repeat', ['png to webp', 'convert png webp', 'transparent webp', 'تحويل'], ['png'], ['webp'], ['jpg-to-webp', 'webp-to-png', 'png-to-jpg'], false, 10),
  T('webp-to-jpg', 'convert', 'repeat', ['webp to jpg', 'convert webp', 'webp2jpg', 'تحويل'], ['webp'], ['jpg'], ['jpg-to-webp', 'png-to-jpg', 'webp-to-png'], false, 10),
  T('webp-to-png', 'convert', 'repeat', ['webp to png', 'convert webp png', 'webp2png', 'تحويل'], ['webp'], ['png'], ['png-to-webp', 'jpg-to-png', 'webp-to-jpg'], false, 10),
  T('image-to-pdf', 'pdf', 'file-text', ['image to pdf', 'photo to pdf', 'jpg to pdf', 'png to pdf', 'pdf'], ['jpg', 'png', 'webp'], ['pdf'], ['images-to-pdf', 'image-resizer', 'merge-images'], true, 1),
  T('images-to-pdf', 'pdf', 'file-text', ['images to pdf', 'multiple photos pdf', 'combine pdf', 'jpg to pdf'], ['jpg', 'png', 'webp'], ['pdf'], ['image-to-pdf', 'merge-images', 'image-compressor'], true, 30),
  T('merge-images', 'edit', 'merge', ['merge', 'combine', 'side by side', 'collage', 'stack', 'دمج'], ['jpg', 'png', 'webp'], ['png', 'jpg'], ['split-image', 'images-to-pdf', 'image-resizer'], false, 10),
  T('split-image', 'edit', 'grid', ['split', 'grid', 'tiles', 'slice', 'carousel', 'تقسيم'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['merge-images', 'image-cropper', 'image-resizer'], false, 1),
  T('image-color-picker', 'color', 'pipette', ['color picker', 'eyedropper', 'hex', 'rgb', 'hsl', 'pixel color', 'منتقي الألوان'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['color-palette-extractor', 'image-to-grayscale', 'image-watermark'], true, 1),
  T('color-palette-extractor', 'color', 'palette', ['palette', 'dominant colors', 'extract colors', 'color scheme', 'لوحة الألوان'], ['jpg', 'png', 'webp'], ['png', 'json'], ['image-color-picker', 'image-to-grayscale', 'image-watermark'], true, 1),
  T('image-to-grayscale', 'edit', 'grayscale', ['grayscale', 'black and white', 'monochrome', 'bw', 'رمادي'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['image-color-picker', 'image-compressor', 'image-rotator'], false, 1),
  T('image-watermark', 'edit', 'stamp', ['watermark', 'logo overlay', 'text overlay', 'copyright', 'علامة مائية'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['merge-images', 'image-resizer', 'image-compressor'], true, 1),
];

export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function toolsInCategory(slug: CategorySlug): ToolDef[] {
  return TOOLS.filter((t) => t.category === slug);
}

export function getRelatedTools(slug: string): ToolDef[] {
  const tool = getTool(slug);
  if (!tool) return [];
  return tool.relatedTools
    .map((s) => getTool(s))
    .filter((t): t is ToolDef => Boolean(t))
    .slice(0, 4);
}

export function getPopularTools(): ToolDef[] {
  return TOOLS.filter((t) => t.popular).slice(0, 8);
}

export function categoryToolCount(slug: CategorySlug): number {
  return toolsInCategory(slug).length;
}

export const SLUGS = TOOLS.map((t) => t.slug);
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);
