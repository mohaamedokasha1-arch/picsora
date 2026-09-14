import type { OutputFormat } from '@/lib/types';
import type { UploadExtension } from '@/lib/validation';

export type CategorySlug =
  | 'compress'
  | 'resize'
  | 'convert'
  | 'edit'
  | 'color'
  | 'pdf-tools'
  | 'text-tools'
  | 'calculator-tools'
  | 'developer-tools';

/**
 * The "kind" decides which shell renders the tool:
 * - `image` tools use the image ToolWorkspace (decode + preview pipeline)
 * - every other kind renders its own self-contained client component.
 */
export type ToolKind = 'image' | 'pdf' | 'text' | 'calculator' | 'developer';

export interface CategoryDef {
  slug: CategorySlug;
  nameKey: string; // categoryMeta.<slug>.name
  descriptionKey: string; // categoryMeta.<slug>.description
  introKey: string; // categoryIntros.<slug>
  icon: string;
  /** Tailwind-friendly accent token, used for category chrome. */
  accent?: string;
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
  inputFormats: UploadExtension[];
  outputFormats: OutputFormat[];
  maxFileSizeMB: number;
  maxFiles: number;
  relatedTools: string[];
  popular?: boolean;
  kind: ToolKind;
  /** Shows a "New" badge in listings. */
  isNew?: boolean;
  /** Extra categories the tool is cross-listed in (e.g. images-to-pdf). */
  alsoIn?: CategorySlug[];
  /** Accent color token used by the category/tool chrome. */
  accent?: string;
}

export const CATEGORIES: CategoryDef[] = [
  { slug: 'compress', nameKey: 'categoryMeta.compress.name', descriptionKey: 'categoryMeta.compress.description', introKey: 'categoryIntros.compress', icon: 'gauge' },
  { slug: 'resize', nameKey: 'categoryMeta.resize.name', descriptionKey: 'categoryMeta.resize.description', introKey: 'categoryIntros.resize', icon: 'scaling' },
  { slug: 'convert', nameKey: 'categoryMeta.convert.name', descriptionKey: 'categoryMeta.convert.description', introKey: 'categoryIntros.convert', icon: 'repeat' },
  { slug: 'edit', nameKey: 'categoryMeta.edit.name', descriptionKey: 'categoryMeta.edit.description', introKey: 'categoryIntros.edit', icon: 'pencil' },
  { slug: 'color', nameKey: 'categoryMeta.color.name', descriptionKey: 'categoryMeta.color.description', introKey: 'categoryIntros.color', icon: 'palette' },
  { slug: 'pdf-tools', nameKey: 'categoryMeta.pdf-tools.name', descriptionKey: 'categoryMeta.pdf-tools.description', introKey: 'categoryIntros.pdf-tools', icon: 'file-pdf', accent: 'red' },
  { slug: 'text-tools', nameKey: 'categoryMeta.text-tools.name', descriptionKey: 'categoryMeta.text-tools.description', introKey: 'categoryIntros.text-tools', icon: 'type', accent: 'green' },
  { slug: 'calculator-tools', nameKey: 'categoryMeta.calculator-tools.name', descriptionKey: 'categoryMeta.calculator-tools.description', introKey: 'categoryIntros.calculator-tools', icon: 'calculator', accent: 'purple' },
  { slug: 'developer-tools', nameKey: 'categoryMeta.developer-tools.name', descriptionKey: 'categoryMeta.developer-tools.description', introKey: 'categoryIntros.developer-tools', icon: 'code', accent: 'cyan' },
];

/**
 * Every raster image input the image conversion tools accept. Besides the
 * usual web staples this includes BMP / TIFF / AVIF / SVG plus the whole
 * iPhone HEIC / HEIF family (HEIC is decoded locally via heic2any before
 * any processing), so photos straight off an iPhone can be dropped into
 * any converter. Alias extensions (jpeg, tif) are kept too, because the
 * uploader matches file extensions exactly.
 */
const ALL_IMAGE_INPUTS: UploadExtension[] = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'avif',
  'svg',
  'heic',
  'heif',
];

const T = (
  slug: string,
  category: CategorySlug,
  icon: string,
  keywords: string[],
  inputFormats: UploadExtension[],
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
  kind: 'image',
});

const IMAGE_TOOLS: ToolDef[] = [
  T('image-compressor', 'compress', 'gauge', ['image compressor', 'compress image', 'compress jpg', 'compress png', 'reduce image size', 'reduce photo size', 'online image compressor', 'optimize', 'shrink', 'ضغط الصور', 'تقليل حجم الصورة', 'ضغط jpg', 'ضغط png'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['image-resizer', 'jpg-to-webp', 'png-to-jpg', 'image-to-grayscale'], true, 20),
  T('image-resizer', 'resize', 'scaling', ['image resizer', 'resize image', 'resize photo', 'change image size', 'dimensions', 'pixels', 'scale', 'width', 'height', 'تغيير حجم الصورة', 'تصغير الصورة'], ['jpg', 'png', 'webp', 'gif'], ['jpg', 'png', 'webp', 'gif'], ['image-compressor', 'image-cropper', 'image-rotator'], true, 1),
  T('image-cropper', 'edit', 'crop', ['crop image', 'image cropper', 'crop photo', 'cut image', 'aspect ratio', 'trim', 'قص الصور', 'قص الصورة', 'اقتصاص الصور'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['image-resizer', 'image-rotator', 'split-image'], true, 1),
  T('image-rotator', 'edit', 'rotate', ['rotate', 'turn', '90 degrees', '180', 'angle', 'تدوير'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['flip-image-horizontal', 'flip-image-vertical', 'image-cropper'], false, 1),
  T('flip-image-horizontal', 'edit', 'flip-horizontal', ['flip', 'mirror', 'horizontal', 'reflect', 'انعكاس'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['flip-image-vertical', 'image-rotator', 'image-cropper'], false, 1),
  T('flip-image-vertical', 'edit', 'flip-vertical', ['flip', 'mirror', 'vertical', 'upside down', 'انعكاس'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['flip-image-horizontal', 'image-rotator', 'image-cropper'], false, 1),
  // Conversion tools accept *any* image type in the drop zone (including
  // iPhone HEIC/HEIF) and always output the format shown in the tool name.
  T('jpg-to-png', 'convert', 'repeat', ['jpg to png', 'jpeg to png', 'convert jpg', 'jpg2png', 'تحويل'], [...ALL_IMAGE_INPUTS], ['png'], ['png-to-jpg', 'jpg-to-webp', 'image-compressor'], true, 10),
  T('png-to-jpg', 'convert', 'repeat', ['png to jpg', 'convert png', 'png2jpg', 'transparent to white', 'تحويل'], [...ALL_IMAGE_INPUTS], ['jpg'], ['jpg-to-png', 'png-to-webp', 'webp-to-jpg'], true, 10),
  T('jpg-to-webp', 'convert', 'repeat', ['jpg to webp', 'convert to webp', 'jpeg webp', 'تحويل'], [...ALL_IMAGE_INPUTS], ['webp'], ['png-to-webp', 'webp-to-jpg', 'image-compressor'], false, 10),
  T('png-to-webp', 'convert', 'repeat', ['png to webp', 'convert png webp', 'transparent webp', 'تحويل'], [...ALL_IMAGE_INPUTS], ['webp'], ['jpg-to-webp', 'webp-to-png', 'png-to-jpg'], false, 10),
  T('webp-to-jpg', 'convert', 'repeat', ['webp to jpg', 'convert webp', 'webp2jpg', 'تحويل'], [...ALL_IMAGE_INPUTS], ['jpg'], ['jpg-to-webp', 'png-to-jpg', 'webp-to-png'], false, 10),
  T('webp-to-png', 'convert', 'repeat', ['webp to png', 'convert webp png', 'webp2png', 'تحويل'], [...ALL_IMAGE_INPUTS], ['png'], ['png-to-webp', 'jpg-to-png', 'webp-to-jpg'], false, 10),
  T('image-to-pdf', 'pdf-tools', 'file-text', ['image to pdf', 'photo to pdf', 'jpg to pdf', 'png to pdf', 'convert image to pdf', 'صورة الى pdf', 'تحويل صورة الى pdf'], ['jpg', 'png', 'webp'], ['pdf'], ['images-to-pdf', 'image-resizer', 'merge-images'], true, 1),
  T('images-to-pdf', 'pdf-tools', 'file-text', ['images to pdf', 'multiple photos pdf', 'combine pdf', 'jpg to pdf', 'صور الى pdf'], ['jpg', 'png', 'webp'], ['pdf'], ['image-to-pdf', 'pdf-merger', 'pdf-compressor'], true, 30),
  T('merge-images', 'edit', 'merge', ['merge', 'combine', 'side by side', 'collage', 'stack', 'دمج'], ['jpg', 'png', 'webp'], ['png', 'jpg'], ['split-image', 'images-to-pdf', 'image-resizer'], false, 10),
  T('split-image', 'edit', 'grid', ['split', 'grid', 'tiles', 'slice', 'carousel', 'تقسيم'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['merge-images', 'image-cropper', 'image-resizer'], false, 1),
  T('image-color-picker', 'color', 'pipette', ['color picker', 'eyedropper', 'hex', 'rgb', 'hsl', 'pixel color', 'منتقي الألوان'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['color-palette-extractor', 'image-to-grayscale', 'image-watermark'], true, 1),
  T('color-palette-extractor', 'color', 'palette', ['palette', 'dominant colors', 'extract colors', 'color scheme', 'لوحة الألوان'], ['jpg', 'png', 'webp'], ['png', 'json'], ['image-color-picker', 'image-to-grayscale', 'image-watermark'], true, 1),
  T('image-to-grayscale', 'edit', 'grayscale', ['grayscale', 'black and white', 'monochrome', 'bw', 'رمادي'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['image-color-picker', 'image-compressor', 'image-rotator'], false, 1),
  T('image-watermark', 'edit', 'stamp', ['watermark', 'logo overlay', 'text overlay', 'copyright', 'علامة مائية'], ['jpg', 'png', 'webp'], ['jpg', 'png', 'webp'], ['merge-images', 'image-resizer', 'image-compressor'], true, 1),
];


/**
 * Definition helper for the non-image tool families (PDF / text / calculator /
 * developer). These tools do not go through the image decode pipeline, so the
 * format fields describe their real inputs/outputs for the UI + SEO copy.
 */
interface NewToolOptions {
  inputFormats?: ToolDef['inputFormats'];
  outputFormats?: ToolDef['outputFormats'];
  maxFileSizeMB?: number;
  maxFiles?: number;
  popular?: boolean;
  /**
   * Shows the "New" badge. Only genuinely recent additions set this — a badge
   * on every tool would tell the user nothing.
   */
  isNew?: boolean;
}

const N = (
  slug: string,
  category: CategorySlug,
  kind: ToolKind,
  icon: string,
  keywords: string[],
  relatedTools: string[],
  options: NewToolOptions = {},
): ToolDef => ({
  slug,
  nameKey: `tools.${slug}.name`,
  shortKey: `tools.${slug}.short`,
  descriptionKey: `tools.${slug}.description`,
  introKey: `tools.${slug}.intro`,
  howToKey: `tools.${slug}.howTo`,
  faqsKey: `tools.${slug}.faqs`,
  category,
  kind,
  icon,
  keywords,
  inputFormats: options.inputFormats ?? [],
  outputFormats: options.outputFormats ?? [],
  maxFileSizeMB: options.maxFileSizeMB ?? 100,
  maxFiles: options.maxFiles ?? 1,
  relatedTools,
  popular: options.popular ?? false,
  isNew: options.isNew ?? false,
});

const PDF_TOOLS: ToolDef[] = [
  N('pdf-merger', 'pdf-tools', 'pdf', 'file-plus', ['merge pdf', 'combine pdf', 'join pdf', 'pdf merger', 'merge pdf files', 'دمج pdf', 'دمج ملفات pdf'], ['pdf-splitter', 'pdf-extract-pages', 'images-to-pdf', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'], maxFileSizeMB: 50, maxFiles: 20, popular: true }),
  N('pdf-splitter', 'pdf-tools', 'pdf', 'scissors', ['split pdf', 'separate pdf pages', 'pdf splitter', 'divide pdf', 'تقسيم pdf'], ['pdf-merger', 'pdf-extract-pages', 'pdf-delete-pages', 'pdf-page-counter'], { inputFormats: ['pdf'], outputFormats: ['pdf', 'zip'], popular: true }),
  N('pdf-delete-pages', 'pdf-tools', 'pdf', 'file-minus', ['delete pdf pages', 'remove pages', 'pdf page remover', 'حذف صفحات pdf'], ['pdf-extract-pages', 'pdf-reorder-pages', 'pdf-splitter', 'pdf-rotate-pages'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-reorder-pages', 'pdf-tools', 'pdf', 'list-ordered', ['reorder pdf pages', 'rearrange pdf', 'sort pdf pages', 'ترتيب صفحات pdf'], ['pdf-delete-pages', 'pdf-rotate-pages', 'pdf-merger', 'pdf-extract-pages'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-rotate-pages', 'pdf-tools', 'pdf', 'rotate', ['rotate pdf', 'turn pdf pages', 'fix pdf orientation', 'تدوير pdf'], ['pdf-reorder-pages', 'pdf-delete-pages', 'pdf-to-images', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-extract-pages', 'pdf-tools', 'pdf', 'file-output', ['extract pdf pages', 'get pages from pdf', 'pdf page extractor', 'استخراج صفحات pdf'], ['pdf-splitter', 'pdf-delete-pages', 'pdf-merger', 'pdf-to-images'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-protect', 'pdf-tools', 'pdf', 'lock', ['protect pdf', 'password pdf', 'encrypt pdf', 'secure pdf', 'حماية pdf بكلمة مرور'], ['pdf-unlock', 'pdf-compressor', 'pdf-merger', 'pdf-page-counter'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-unlock', 'pdf-tools', 'pdf', 'unlock', ['unlock pdf', 'remove pdf password', 'decrypt pdf', 'فك حماية pdf'], ['pdf-protect', 'pdf-merger', 'pdf-splitter', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-to-images', 'pdf-tools', 'pdf', 'image-down', ['pdf to jpg', 'pdf to png', 'pdf to image', 'convert pdf to image', 'pdf to jpg converter', 'pdf إلى صور', 'تحويل pdf إلى صور', 'pdf الى jpg'], ['images-to-pdf', 'pdf-extract-pages', 'pdf-compressor', 'image-compressor'], { inputFormats: ['pdf'], outputFormats: ['jpg', 'png', 'zip'], maxFileSizeMB: 50, popular: true }),
  N('pdf-compressor', 'pdf-tools', 'pdf', 'gauge', ['pdf compressor', 'compress pdf', 'reduce pdf size', 'shrink pdf', 'ضغط pdf', 'ضغط ملفات pdf', 'تصغير حجم pdf'], ['pdf-merger', 'pdf-to-images', 'pdf-splitter', 'image-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'], popular: true }),
  N('pdf-page-counter', 'pdf-tools', 'pdf', 'hash', ['count pdf pages', 'pdf page count', 'how many pages', 'عدد صفحات pdf'], ['pdf-splitter', 'pdf-merger', 'pdf-extract-pages', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: [], maxFileSizeMB: 50, maxFiles: 20 }),
];

const TEXT_TOOLS: ToolDef[] = [
  N('word-counter', 'text-tools', 'text', 'type', ['word counter', 'character count', 'reading time', 'text statistics', 'عداد الكلمات'], ['remove-extra-spaces', 'case-converter', 'text-frequency-counter', 'remove-duplicate-lines'], { popular: true }),
  N('remove-extra-spaces', 'text-tools', 'text', 'space', ['remove extra spaces', 'trim whitespace', 'clean spaces', 'إزالة المسافات الزائدة'], ['text-cleaner', 'word-counter', 'remove-duplicate-lines', 'case-converter'], {}),
  N('case-converter', 'text-tools', 'text', 'case-sensitive', ['case converter', 'uppercase', 'lowercase', 'title case', 'camelcase', 'تحويل حالة الأحرف'], ['text-to-slug', 'word-counter', 'text-reverser', 'remove-extra-spaces'], { popular: true }),
  N('text-cleaner', 'text-tools', 'text', 'eraser', ['text cleaner', 'remove html tags', 'strip urls', 'clean text', 'تنظيف النصوص'], ['remove-extra-spaces', 'remove-duplicate-lines', 'word-counter', 'text-diff'], {}),
  N('lorem-ipsum-generator', 'text-tools', 'text', 'text-quote', ['lorem ipsum', 'placeholder text', 'dummy text', 'نص عشوائي'], ['word-counter', 'case-converter', 'text-to-slug', 'uuid-generator'], {}),
  N('text-reverser', 'text-tools', 'text', 'flip-horizontal', ['reverse text', 'backwards text', 'reverse words', 'عكس النص'], ['case-converter', 'text-cleaner', 'word-counter', 'remove-duplicate-lines'], {}),
  N('remove-duplicate-lines', 'text-tools', 'text', 'list-x', ['remove duplicate lines', 'dedupe list', 'unique lines', 'إزالة الأسطر المكررة'], ['text-cleaner', 'remove-extra-spaces', 'word-counter', 'text-diff'], {}),
  N('text-to-slug', 'text-tools', 'text', 'link', ['slug generator', 'url slug', 'permalink', 'seo slug', 'مولد الروابط'], ['case-converter', 'url-encoder-decoder', 'text-cleaner', 'word-counter'], {}),
  N('text-diff', 'text-tools', 'text', 'git-compare', ['text diff', 'compare text', 'difference checker', 'مقارنة النصوص'], ['word-counter', 'text-cleaner', 'remove-duplicate-lines', 'json-formatter'], { popular: true }),
  N('number-to-words', 'text-tools', 'text', 'spell-check', ['number to words', 'spell numbers', 'amount in words', 'تفقيط الأرقام'], ['percentage-calculator', 'unit-converter', 'word-counter', 'number-base-converter'], {}),
];

const CALCULATOR_TOOLS: ToolDef[] = [
  N('age-calculator', 'calculator-tools', 'calculator', 'cake', ['age calculator', 'how old am i', 'birthday calculator', 'حاسبة العمر'], ['date-difference-calculator', 'bmi-calculator', 'percentage-calculator', 'unit-converter'], { popular: true }),
  N('bmi-calculator', 'calculator-tools', 'calculator', 'activity', ['bmi calculator', 'body mass index', 'healthy weight', 'حاسبة كتلة الجسم'], ['age-calculator', 'unit-converter', 'percentage-calculator', 'date-difference-calculator'], { popular: true }),
  N('percentage-calculator', 'calculator-tools', 'calculator', 'percent', ['percentage calculator', 'percent change', 'discount percent', 'حاسبة النسبة المئوية'], ['discount-calculator', 'interest-calculator', 'tip-calculator', 'number-to-words'], { popular: true }),
  N('interest-calculator', 'calculator-tools', 'calculator', 'trending-up', ['interest calculator', 'compound interest', 'simple interest', 'حاسبة الفائدة'], ['percentage-calculator', 'currency-converter', 'discount-calculator', 'date-difference-calculator'], {}),
  N('date-difference-calculator', 'calculator-tools', 'calculator', 'calendar-days', ['date difference', 'days between dates', 'business days', 'حاسبة الفرق بين تاريخين'], ['age-calculator', 'unit-converter', 'interest-calculator', 'percentage-calculator'], {}),
  N('unit-converter', 'calculator-tools', 'calculator', 'ruler', ['unit converter', 'length weight temperature', 'metric imperial', 'محول الوحدات'], ['currency-converter', 'number-base-converter', 'percentage-calculator', 'bmi-calculator'], { popular: true }),
  N('discount-calculator', 'calculator-tools', 'calculator', 'tag', ['discount calculator', 'sale price', 'percent off', 'حاسبة الخصم'], ['percentage-calculator', 'tip-calculator', 'currency-converter', 'interest-calculator'], {}),
  N('gpa-calculator', 'calculator-tools', 'calculator', 'graduation-cap', ['gpa calculator', 'grade point average', 'semester gpa', 'حاسبة المعدل التراكمي'], ['percentage-calculator', 'age-calculator', 'unit-converter', 'date-difference-calculator'], {}),
  N('tip-calculator', 'calculator-tools', 'calculator', 'hand-coins', ['tip calculator', 'split bill', 'gratuity', 'حاسبة البقشيش'], ['discount-calculator', 'percentage-calculator', 'currency-converter', 'interest-calculator'], {}),
  N('currency-converter', 'calculator-tools', 'calculator', 'coins', ['currency converter', 'exchange rate', 'usd to eur', 'محول العملات'], ['unit-converter', 'interest-calculator', 'discount-calculator', 'percentage-calculator'], {}),
];

/**
 * iPhone photos (HEIC / HEIF) are accepted by every generic image tool.
 * The conversion tools above already list them via ALL_IMAGE_INPUTS, so
 * this only fills the gap for the remaining tools.
 */
const IPHONE_EXTRA: UploadExtension[] = ['heic', 'heif'];

for (const tool of IMAGE_TOOLS) {
  for (const extra of IPHONE_EXTRA) {
    if (!tool.inputFormats.includes(extra)) tool.inputFormats.push(extra);
  }
}

/** Smarter internal linking: point existing tools at the new helpers. */
const RELATED_PATCH: Record<string, string[]> = {
  'image-compressor': ['image-to-exact-kb', 'heic-to-jpg'],
  'image-resizer': ['passport-photo-maker', 'image-to-exact-kb'],
  'image-cropper': ['passport-photo-maker', 'background-remover'],
  'jpg-to-png': ['heic-to-png', 'png-to-webp'],
  'png-to-jpg': ['heic-to-jpg', 'jpg-to-webp'],
  'image-to-grayscale': ['signature-maker', 'background-remover'],
  'images-to-pdf': ['pdf-to-text', 'pdf-to-word'],
  'image-to-pdf': ['pdf-to-text', 'images-to-pdf'],
  'merge-images': ['passport-photo-maker', 'split-image'],
  'image-watermark': ['signature-maker', 'image-compressor'],
};

for (const tool of IMAGE_TOOLS) {
  const extra = RELATED_PATCH[tool.slug];
  // Set() so a tool that is already suggested by the tool itself (or by two
  // patch lists) is never listed twice.
  if (extra) tool.relatedTools = [...new Set([...extra, ...tool.relatedTools])].slice(0, 6);
}

const NEW_IMAGE_TOOLS: ToolDef[] = [
  {
    ...T(
      'heic-to-jpg',
      'convert',
      'repeat',
      ['heic to jpg', 'heif to jpg', 'iphone photo converter', 'convert heic', 'heic2jpg', 'تحويل heic الى jpg', 'صور الايفون'],
      [...ALL_IMAGE_INPUTS],
      ['jpg'],
      ['heic-to-png', 'jpg-to-png', 'image-compressor', 'image-to-exact-kb'],
      true,
      10,
    ),
    isNew: true,
  },
  {
    ...T(
      'heic-to-png',
      'convert',
      'repeat',
      ['heic to png', 'heif to png', 'iphone to png', 'convert heic png', 'تحويل heic الى png'],
      [...ALL_IMAGE_INPUTS],
      ['png'],
      ['heic-to-jpg', 'jpg-to-png', 'png-to-webp', 'image-compressor'],
      false,
      10,
    ),
    isNew: true,
  },
  {
    ...T(
      'image-to-exact-kb',
      'compress',
      'gauge',
      ['exact kb', 'exact file size', 'compress to 100kb', 'reduce to specific size', 'image to kb', 'تصغير حجم الصورة الى كيلوبايت', 'ضغط لرقم محدد'],
      ['jpg', 'png', 'webp', 'heic', 'heif'],
      ['jpg', 'png', 'webp'],
      ['image-compressor', 'image-resizer', 'jpg-to-webp', 'heic-to-jpg'],
      true,
      10,
    ),
    isNew: true,
  },
  {
    ...T(
      'background-remover',
      'edit',
      'eraser',
      ['background remover', 'remove bg', 'transparent background', 'cutout', 'erase background', 'ازالة الخلفية', 'خلفية شفافة'],
      ['jpg', 'png', 'webp', 'heic'],
      ['png'],
      ['signature-maker', 'image-to-grayscale', 'png-to-webp', 'image-cropper'],
      true,
      1,
    ),
    isNew: true,
  },
  {
    ...T(
      'passport-photo-maker',
      'edit',
      'id-card',
      ['passport photo', 'id photo', 'visa photo', '35x45', '2x2 photo', 'صورة جواز', 'صورة شخصية'],
      ['jpg', 'png', 'webp', 'heic'],
      ['jpg', 'png'],
      ['image-resizer', 'image-cropper', 'background-remover', 'image-compressor'],
      true,
      1,
    ),
    isNew: true,
  },
  {
    ...T(
      'signature-maker',
      'edit',
      'pen-line',
      ['signature maker', 'transparent signature', 'sign png', 'digital signature image', 'التوقيع الالكتروني', 'توقيع شفاف'],
      ['jpg', 'png', 'webp', 'heic'],
      ['png'],
      ['background-remover', 'image-to-grayscale', 'image-cropper', 'image-watermark'],
      false,
      1,
    ),
    isNew: true,
  },
  {
    ...T(
      'image-ocr',
      'convert',
      'scan-text',
      ['image ocr', 'extract text from image', 'photo to text', 'jpg to text', 'screenshot to text', 'استخراج النص من الصور'],
      [...ALL_IMAGE_INPUTS],
      ['txt'],
      ['pdf-ocr', 'pdf-to-text', 'word-counter', 'heic-to-jpg'],
      true,
      5,
    ),
    isNew: true,
  },
];

const NEW_PDF_TOOLS: ToolDef[] = [
  N('pdf-to-text', 'pdf-tools', 'pdf', 'file-text', ['pdf to text', 'extract text from pdf', 'pdf to txt', 'copy text pdf', 'استخراج النص من pdf'], ['pdf-to-word', 'pdf-ocr', 'pdf-to-images', 'word-counter'], { inputFormats: ['pdf'], outputFormats: ['txt', 'zip'], maxFileSizeMB: 50, maxFiles: 5, popular: true, isNew: true }),
  N('pdf-to-word', 'pdf-tools', 'pdf', 'file-type', ['pdf to word', 'pdf to doc', 'convert pdf editable', 'pdf word converter', 'تحويل pdf الى وورد'], ['pdf-to-text', 'pdf-ocr', 'pdf-merger', 'text-to-slug'], { inputFormats: ['pdf'], outputFormats: ['doc', 'zip'], maxFileSizeMB: 50, maxFiles: 5, popular: true, isNew: true }),
  N('pdf-ocr', 'pdf-tools', 'pdf', 'scan-text', ['pdf ocr', 'scanned pdf to text', 'ocr pdf online', 'searchable pdf text', 'pdf ممسوح ضوئيا نص'], ['image-ocr', 'pdf-to-text', 'pdf-to-images', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['txt', 'zip'], maxFileSizeMB: 50, maxFiles: 3, isNew: true }),
];

const NEW_DEVELOPER_TOOLS: ToolDef[] = [
  N('jwt-decoder', 'developer-tools', 'developer', 'key-round', ['jwt decoder', 'jwt debugger', 'decode token', 'json web token', 'verify jwt', 'فك تشفير jwt'], ['base64-encoder-decoder', 'json-formatter', 'hash-generator', 'url-encoder-decoder'], { popular: true, isNew: true }),
  N('sql-formatter', 'developer-tools', 'developer', 'database', ['sql formatter', 'format sql', 'beautify sql', 'sql minify', 'تنسيق sql'], ['json-formatter', 'xml-formatter', 'text-cleaner', 'javascript-formatter'], { isNew: true }),
  N('yaml-formatter', 'developer-tools', 'developer', 'file-json', ['yaml formatter', 'yaml validator', 'yaml to json', 'beautify yaml', 'تنسيق yaml'], ['json-formatter', 'xml-formatter', 'markdown-formatter', 'javascript-formatter'], { isNew: true }),
  N('markdown-formatter', 'developer-tools', 'developer', 'book-open', ['markdown formatter', 'format markdown', 'prettify md', 'markdown preview', 'تنسيق ماركداون'], ['html-encoder-decoder', 'text-to-slug', 'json-formatter', 'lorem-ipsum-generator'], { popular: true, isNew: true }),
];

const DEVELOPER_TOOLS: ToolDef[] = [
  N('uuid-generator', 'developer-tools', 'developer', 'fingerprint', ['uuid generator', 'guid', 'ulid', 'nano id', 'مولد uuid'], ['hash-generator', 'base64-encoder-decoder', 'json-formatter', 'lorem-ipsum-generator'], { popular: true }),
  N('url-encoder-decoder', 'developer-tools', 'developer', 'link-2', ['url encode', 'url decode', 'percent encoding', 'ترميز الروابط'], ['base64-encoder-decoder', 'html-encoder-decoder', 'text-to-slug', 'json-formatter'], {}),
  N('html-encoder-decoder', 'developer-tools', 'developer', 'code-xml', ['html encode', 'html entities', 'escape html', 'ترميز html'], ['url-encoder-decoder', 'base64-encoder-decoder', 'xml-formatter', 'text-cleaner'], {}),
  N('json-formatter', 'developer-tools', 'developer', 'braces', ['json formatter', 'json validator', 'json beautifier', 'minify json', 'تنسيق json'], ['xml-formatter', 'javascript-formatter', 'base64-encoder-decoder', 'text-diff'], { popular: true }),
  N('xml-formatter', 'developer-tools', 'developer', 'file-code', ['xml formatter', 'xml validator', 'xml to json', 'تنسيق xml'], ['json-formatter', 'html-encoder-decoder', 'css-formatter', 'javascript-formatter'], {}),
  N('javascript-formatter', 'developer-tools', 'developer', 'braces', ['javascript formatter', 'js beautifier', 'js minifier', 'terser', 'تنسيق جافاسكربت'], ['css-formatter', 'json-formatter', 'xml-formatter', 'regex-tester'], {}),
  N('css-formatter', 'developer-tools', 'developer', 'paintbrush', ['css formatter', 'css beautifier', 'css minifier', 'تنسيق css'], ['javascript-formatter', 'json-formatter', 'color-converter', 'html-encoder-decoder'], {}),
  N('regex-tester', 'developer-tools', 'developer', 'regex', ['regex tester', 'regular expression', 'pattern match', 'اختبار التعبيرات النمطية'], ['json-formatter', 'text-diff', 'text-cleaner', 'javascript-formatter'], { popular: true }),
  N('base64-encoder-decoder', 'developer-tools', 'developer', 'binary', ['base64 encode', 'base64 decode', 'data uri', 'ترميز base64'], ['url-encoder-decoder', 'hash-generator', 'html-encoder-decoder', 'uuid-generator'], { maxFileSizeMB: 25 }),
  N('color-converter', 'developer-tools', 'developer', 'palette', ['color converter', 'hex to rgb', 'hsl', 'cmyk', 'contrast checker', 'محول الألوان'], ['image-color-picker', 'color-palette-extractor', 'css-formatter', 'hash-generator'], {}),
  N('hash-generator', 'developer-tools', 'developer', 'shield', ['hash generator', 'sha256', 'sha512', 'checksum', 'مولد التجزئة'], ['uuid-generator', 'base64-encoder-decoder', 'json-formatter', 'number-base-converter'], { maxFileSizeMB: 200 }),
  N('number-base-converter', 'developer-tools', 'developer', 'binary', ['base converter', 'binary to decimal', 'hex converter', 'octal', 'محول الأنظمة العددية'], ['hash-generator', 'unit-converter', 'number-to-words', 'uuid-generator'], {}),
];

/**
 * Effect & utility tools added on top of the original image set. They reuse
 * the existing image workspace (upload → live preview → download) and run
 * entirely on canvas ImageData.
 */
const EFFECT_TOOLS: ToolDef[] = [
  {
    ...T(
      'image-blur',
      'edit',
      'blur',
      ['blur image', 'blur photo', 'blur face', 'blur a face', 'blur number plate', 'blur license plate', 'hide number plate', 'censor', 'hide face', 'redact', 'hide personal information', 'gaussian blur', 'mosaic', 'تمويه الصورة', 'طمس الوجه', 'اخفاء معلومات'],
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif'],
      ['jpg', 'png', 'webp'],
      ['image-pixelate', 'image-cropper', 'image-filters', 'image-compressor'],
      true,
      1,
    ),
    isNew: true,
  },
  {
    ...T(
      'image-pixelate',
      'edit',
      'pixelate',
      ['pixelate image', 'pixelate photo', 'pixelate number plate', 'mosaic', 'censor', 'blur a face', 'hide face', 'hide number', 'hide text in photo', 'redact screenshot', 'تمويه', 'بيكسل', 'اخفاء الوجه'],
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif'],
      ['jpg', 'png', 'webp'],
      ['image-blur', 'image-cropper', 'image-filters', 'image-compressor'],
      true,
      1,
    ),
    isNew: true,
  },
  {
    ...T(
      'brightness-contrast',
      'edit',
      'brightness',
      ['brightness and contrast', 'adjust brightness', 'adjust contrast', 'darken image', 'brighten image', 'lighten photo', 'exposure fix', 'تحسين الصورة', 'السطوع', 'التباين', 'تفتيح الصورة'],
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif'],
      ['jpg', 'png', 'webp'],
      ['image-filters', 'image-to-grayscale', 'image-compressor', 'image-resizer'],
      true,
      1,
    ),
    isNew: true,
  },
  {
    ...T(
      'image-filters',
      'edit',
      'sliders-h',
      ['image filters', 'photo filters', 'sepia filter', 'invert colors', 'negative image', 'sharpen image', 'black and white filter', 'فلتر الصور', 'سيبيا', 'عكس الالوان', 'زيادة الحدة'],
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif'],
      ['jpg', 'png', 'webp'],
      ['image-to-grayscale', 'brightness-contrast', 'image-compressor', 'image-watermark'],
      false,
      1,
    ),
    isNew: true,
  },
  {
    ...T(
      'rounded-corners',
      'edit',
      'squircle',
      ['rounded corners', 'round image corners', 'circle corners', 'border radius image', 'round photo', 'profile picture round', 'زوايا دائرية', 'تدوير الحواف'],
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'heic', 'heif'],
      ['png', 'webp', 'jpg'],
      ['image-resizer', 'image-cropper', 'image-compressor', 'image-watermark'],
      false,
      1,
    ),
    isNew: true,
  },
  {
    ...T(
      'image-metadata',
      'edit',
      'file-search',
      ['image metadata', 'exif viewer', 'exif data', 'photo metadata', 'check gps', 'camera information', 'image info', 'بيانات الصورة', 'exif', 'معلومات الصورة'],
      ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'],
      ['json'],
      ['image-compressor', 'image-blur', 'image-resizer', 'image-to-grayscale'],
      false,
      1,
    ),
    isNew: true,
  },
];

const NEW_PDF_TOOLS_2: ToolDef[] = [
  N('pdf-page-numbers', 'pdf-tools', 'pdf', 'file-digit', ['add page numbers to pdf', 'pdf page numberer', 'number pdf pages', 'paginate pdf', 'ترقيم صفحات pdf', 'اضافة ارقام للصفحات'], ['pdf-watermark', 'pdf-rotate-pages', 'pdf-merger', 'pdf-reorder-pages'], { inputFormats: ['pdf'], outputFormats: ['pdf'], maxFileSizeMB: 100, popular: true, isNew: true }),
  N('pdf-watermark', 'pdf-tools', 'pdf', 'stamp', ['pdf watermark', 'watermark pdf', 'add watermark', 'draft stamp', 'confidential stamp', 'علامة مائية pdf', 'ختم pdf'], ['pdf-page-numbers', 'image-watermark', 'pdf-protect', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'], maxFileSizeMB: 100, popular: true, isNew: true }),
  N('pdf-grayscale', 'pdf-tools', 'pdf', 'contrast', ['pdf grayscale', 'pdf black and white', 'convert pdf to grayscale', 'monochrome pdf', 'تحويل pdf الى ابيض واسود', 'رمادي'], ['pdf-compressor', 'pdf-watermark', 'pdf-to-images', 'image-to-grayscale'], { inputFormats: ['pdf'], outputFormats: ['pdf'], maxFileSizeMB: 50, isNew: true }),
  N('pdf-metadata-editor', 'pdf-tools', 'pdf', 'file-pen', ['pdf metadata', 'edit pdf metadata', 'change pdf title', 'pdf author', 'pdf properties', 'تعديل بيانات pdf', 'عنوان الملف'], ['pdf-extract-images', 'pdf-compressor', 'pdf-page-counter', 'pdf-protect'], { inputFormats: ['pdf'], outputFormats: ['pdf'], maxFileSizeMB: 100, isNew: true }),
  N('pdf-extract-images', 'pdf-tools', 'pdf', 'images', ['extract images from pdf', 'pdf image extractor', 'save photos from pdf', 'get images pdf', 'استخراج الصور من pdf'], ['pdf-to-images', 'pdf-metadata-editor', 'images-to-pdf', 'image-compressor'], { inputFormats: ['pdf'], outputFormats: ['jpg', 'png', 'zip'], maxFileSizeMB: 50, isNew: true }),
];

const NEW_TEXT_TOOLS_2: ToolDef[] = [
  N('line-sorter', 'text-tools', 'text', 'arrow-down-a-z', ['sort lines', 'sort list alphabetically', 'alphabetize', 'sort a to z', 'sort numbers', 'order list', 'ترتيب الاسطر', 'ترتيب ابجدي', 'ترتيب القائمة'], ['remove-duplicate-lines', 'text-cleaner', 'word-counter', 'case-converter'], { popular: true, isNew: true }),
  N('text-extractor', 'text-tools', 'text', 'text-search', ['extract urls', 'extract emails', 'extract phone numbers', 'find links in text', 'email extractor', 'استخراج الروابط', 'استخراج الايميلات', 'استخراج الارقام'], ['word-counter', 'text-cleaner', 'remove-duplicate-lines', 'url-parser'], { popular: true, isNew: true }),
  N('text-frequency-counter', 'text-tools', 'text', 'hash', ['word frequency', 'character frequency', 'count how many times a word appears', 'find repeated words', 'letter frequency', 'word frequency counter', 'تكرار الكلمات', 'تكرار الحروف'], ['word-counter', 'line-sorter', 'text-extractor', 'remove-duplicate-lines'], { popular: true, isNew: true }),
];

const NEW_DEVELOPER_TOOLS_2: ToolDef[] = [
  N('json-csv-converter', 'developer-tools', 'developer', 'file-spreadsheet', ['json to csv', 'csv to json', 'convert json csv', 'excel csv', 'json spreadsheet', 'تحويل json الى csv', 'تحويل csv'], ['json-formatter', 'yaml-formatter', 'xml-formatter', 'number-base-converter'], { popular: true, isNew: true }),
  N('url-parser', 'developer-tools', 'developer', 'waypoints', ['url parser', 'parse url', 'query string parser', 'url components', 'break down url', 'تحليل الرابط', 'مكونات الرابط'], ['url-encoder-decoder', 'json-formatter', 'text-extractor', 'base64-encoder-decoder'], { isNew: true }),
  N('timestamp-converter', 'developer-tools', 'developer', 'calendar-clock', ['unix timestamp', 'epoch converter', 'timestamp to date', 'date to timestamp', 'convert epoch', 'محول التوقيت', 'الطابع الزمني'], ['date-difference-calculator', 'cron-generator', 'age-calculator', 'json-formatter'], { popular: true, isNew: true }),
  N('cron-generator', 'developer-tools', 'developer', 'timer', ['cron generator', 'cron expression', 'cron builder', 'cron schedule', 'crontab', 'مولد cron', 'تعبير cron'], ['timestamp-converter', 'regex-tester', 'json-formatter', 'hash-generator'], { isNew: true }),
];

/** Point established tools at the new helpers (and back) so discovery flows. */
const RELATED_PATCH_2: Record<string, string[]> = {
  'image-cropper': ['image-blur', 'image-pixelate'],
  'image-resizer': ['rounded-corners', 'brightness-contrast'],
  'image-to-grayscale': ['image-filters', 'brightness-contrast'],
  'image-compressor': ['image-metadata', 'image-filters'],
  'png-to-jpg': ['rounded-corners', 'image-blur'],
  'images-to-pdf': ['pdf-page-numbers', 'pdf-watermark'],
  'image-to-pdf': ['pdf-page-numbers', 'pdf-extract-images'],
  'pdf-merger': ['pdf-page-numbers', 'pdf-watermark', 'pdf-metadata-editor'],
  'pdf-splitter': ['pdf-extract-images', 'pdf-page-numbers'],
  'pdf-to-images': ['pdf-extract-images', 'pdf-grayscale'],
  'pdf-compressor': ['pdf-grayscale', 'pdf-watermark'],
  'pdf-protect': ['pdf-metadata-editor', 'pdf-watermark'],
  'pdf-page-counter': ['pdf-page-numbers', 'pdf-metadata-editor'],
  'word-counter': ['text-frequency-counter', 'line-sorter', 'text-extractor'],
  'text-cleaner': ['line-sorter', 'text-extractor'],
  'remove-duplicate-lines': ['line-sorter', 'text-extractor'],
  'case-converter': ['line-sorter', 'text-diff'],
  'json-formatter': ['json-csv-converter', 'url-parser', 'timestamp-converter', 'jwt-decoder'],
  'xml-formatter': ['json-csv-converter', 'json-formatter', 'url-parser', 'sql-formatter'],
  'yaml-formatter': ['json-csv-converter', 'json-formatter', 'timestamp-converter'],
  'url-encoder-decoder': ['url-parser', 'text-extractor', 'json-formatter'],
  'date-difference-calculator': ['timestamp-converter', 'cron-generator'],
  'regex-tester': ['cron-generator', 'text-extractor'],
  'uuid-generator': ['timestamp-converter', 'hash-generator'],
  // Inbound links so no tool is a dead end in the "related tools" graph.
  'percentage-calculator': ['gpa-calculator'],
  'base64-encoder-decoder': ['jwt-decoder'],
};

export const TOOLS: ToolDef[] = [
  ...IMAGE_TOOLS,
  ...EFFECT_TOOLS,
  ...NEW_IMAGE_TOOLS,
  ...PDF_TOOLS,
  ...NEW_PDF_TOOLS,
  ...NEW_PDF_TOOLS_2,
  ...TEXT_TOOLS,
  ...NEW_TEXT_TOOLS_2,
  ...CALCULATOR_TOOLS,
  ...DEVELOPER_TOOLS,
  ...NEW_DEVELOPER_TOOLS,
  ...NEW_DEVELOPER_TOOLS_2,
];

for (const tool of TOOLS) {
  const extra = RELATED_PATCH_2[tool.slug];
  if (extra) tool.relatedTools = [...new Set([...extra, ...tool.relatedTools])].slice(0, 6);
}

/**
 * Workflow-first ordering for the highest-intent tools.
 *
 * Each patch above *prepends* its suggestions, so for the tools that appear in
 * several patches the genuine "what do I do with this file next" neighbours
 * were pushed past the four slots the UI renders. A visitor who had just
 * converted an iPhone photo was offered "HEIC to PNG" (the same conversion
 * again) instead of the compressor or the resizer they actually needed next.
 *
 * These lists are the real next steps in each workflow and are pinned to the
 * front; anything else the tool already suggested is kept behind them, so no
 * existing link is dropped — only reordered.
 */
const WORKFLOW_PRIORITY: Record<string, string[]> = {
  'heic-to-jpg': ['image-compressor', 'image-resizer', 'image-to-pdf'],
  'heic-to-png': ['image-compressor', 'image-resizer', 'png-to-jpg'],
  'image-compressor': ['image-resizer', 'jpg-to-png', 'image-to-pdf', 'image-to-exact-kb'],
  'image-resizer': ['image-compressor', 'image-cropper', 'image-to-pdf'],
  'image-cropper': ['image-resizer', 'image-compressor', 'passport-photo-maker'],
  'jpg-to-png': ['png-to-jpg', 'image-compressor', 'image-resizer'],
  'png-to-jpg': ['jpg-to-png', 'image-compressor', 'image-resizer'],
  'image-to-pdf': ['images-to-pdf', 'pdf-merger', 'pdf-compressor'],
  'images-to-pdf': ['pdf-merger', 'pdf-compressor', 'image-compressor'],
  'pdf-to-word': ['pdf-ocr', 'pdf-compressor', 'pdf-merger', 'pdf-to-text'],
  'pdf-compressor': ['pdf-to-images', 'pdf-to-word', 'pdf-merger'],
  'pdf-merger': ['pdf-splitter', 'pdf-compressor', 'pdf-to-word'],
  'pdf-to-images': ['pdf-compressor', 'images-to-pdf', 'pdf-to-word'],
  'pdf-ocr': ['pdf-to-word', 'pdf-to-text', 'image-ocr'],
  'pdf-to-text': ['pdf-to-word', 'pdf-ocr', 'word-counter'],
  'image-ocr': ['pdf-ocr', 'pdf-to-text', 'image-compressor'],
};

for (const tool of TOOLS) {
  const pinned = WORKFLOW_PRIORITY[tool.slug];
  if (!pinned) continue;
  const valid = pinned.filter((slug) => slug !== tool.slug && TOOLS.some((t) => t.slug === slug));
  tool.relatedTools = [...new Set([...valid, ...tool.relatedTools])].slice(0, 6);
}


export function getTool(slug: string): ToolDef | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getCategory(slug: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function toolsInCategory(slug: CategorySlug): ToolDef[] {
  return TOOLS.filter((t) => t.category === slug || t.alsoIn?.includes(slug));
}

export function getNewTools(limit = 6): ToolDef[] {
  const fresh = TOOLS.filter((t) => t.isNew && t.popular);
  // Round-robin across categories: registry order alone would fill the whole
  // homepage strip with image tools and hide the PDF / text / developer
  // additions, which are just as new.
  const buckets = new Map<CategorySlug, ToolDef[]>();
  for (const tool of fresh) {
    const list = buckets.get(tool.category) ?? [];
    list.push(tool);
    buckets.set(tool.category, list);
  }
  const queues = [...buckets.values()];
  const out: ToolDef[] = [];
  for (let round = 0; out.length < limit; round++) {
    let added = false;
    for (const queue of queues) {
      if (out.length >= limit) break;
      const next = queue[round];
      if (next) {
        out.push(next);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

export function getRelatedTools(slug: string): ToolDef[] {
  const tool = getTool(slug);
  if (!tool) return [];
  // Several tools gain suggestions from more than one patch list, and the same
  // neighbour must never be rendered twice.
  const seen = new Set<string>();
  const related: ToolDef[] = [];
  for (const relatedSlug of tool.relatedTools) {
    if (relatedSlug === slug || seen.has(relatedSlug)) continue;
    const found = getTool(relatedSlug);
    if (!found) continue;
    seen.add(relatedSlug);
    related.push(found);
    if (related.length === 4) break;
  }
  return related;
}

export function getPopularTools(): ToolDef[] {
  return TOOLS.filter((t) => t.popular).slice(0, 8);
}

export function categoryToolCount(slug: CategorySlug): number {
  return toolsInCategory(slug).length;
}

export const SLUGS = TOOLS.map((t) => t.slug);
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);
