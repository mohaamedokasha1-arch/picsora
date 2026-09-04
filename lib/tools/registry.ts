import type { ImageFormat, OutputFormat } from '@/lib/types';

export type CategorySlug =
  | 'compress'
  | 'resize'
  | 'convert'
  | 'edit'
  | 'pdf'
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
  inputFormats: (ImageFormat | 'pdf')[];
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
  { slug: 'pdf', nameKey: 'categoryMeta.pdf.name', descriptionKey: 'categoryMeta.pdf.description', introKey: 'categoryIntros.pdf', icon: 'file-text' },
  { slug: 'color', nameKey: 'categoryMeta.color.name', descriptionKey: 'categoryMeta.color.description', introKey: 'categoryIntros.color', icon: 'palette' },
  { slug: 'pdf-tools', nameKey: 'categoryMeta.pdf-tools.name', descriptionKey: 'categoryMeta.pdf-tools.description', introKey: 'categoryIntros.pdf-tools', icon: 'file-pdf', accent: 'red' },
  { slug: 'text-tools', nameKey: 'categoryMeta.text-tools.name', descriptionKey: 'categoryMeta.text-tools.description', introKey: 'categoryIntros.text-tools', icon: 'type', accent: 'green' },
  { slug: 'calculator-tools', nameKey: 'categoryMeta.calculator-tools.name', descriptionKey: 'categoryMeta.calculator-tools.description', introKey: 'categoryIntros.calculator-tools', icon: 'calculator', accent: 'purple' },
  { slug: 'developer-tools', nameKey: 'categoryMeta.developer-tools.name', descriptionKey: 'categoryMeta.developer-tools.description', introKey: 'categoryIntros.developer-tools', icon: 'code', accent: 'cyan' },
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
  kind: 'image',
});

const IMAGE_TOOLS: ToolDef[] = [
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
  { ...T('images-to-pdf', 'pdf', 'file-text', ['images to pdf', 'multiple photos pdf', 'combine pdf', 'jpg to pdf', 'صور الى pdf'], ['jpg', 'png', 'webp'], ['pdf'], ['image-to-pdf', 'pdf-merger', 'pdf-compressor'], true, 30), alsoIn: ['pdf-tools'] },
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
  isNew: true,
});

const PDF_TOOLS: ToolDef[] = [
  N('pdf-merger', 'pdf-tools', 'pdf', 'file-plus', ['merge pdf', 'combine pdf', 'join pdf', 'pdf merger', 'دمج pdf', 'دمج ملفات pdf'], ['pdf-splitter', 'pdf-extract-pages', 'images-to-pdf', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'], maxFileSizeMB: 50, maxFiles: 20, popular: true }),
  N('pdf-splitter', 'pdf-tools', 'pdf', 'scissors', ['split pdf', 'separate pdf pages', 'pdf splitter', 'divide pdf', 'تقسيم pdf'], ['pdf-merger', 'pdf-extract-pages', 'pdf-delete-pages', 'pdf-page-counter'], { inputFormats: ['pdf'], outputFormats: ['pdf', 'zip'], popular: true }),
  N('pdf-delete-pages', 'pdf-tools', 'pdf', 'file-minus', ['delete pdf pages', 'remove pages', 'pdf page remover', 'حذف صفحات pdf'], ['pdf-extract-pages', 'pdf-reorder-pages', 'pdf-splitter', 'pdf-rotate-pages'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-reorder-pages', 'pdf-tools', 'pdf', 'list-ordered', ['reorder pdf pages', 'rearrange pdf', 'sort pdf pages', 'ترتيب صفحات pdf'], ['pdf-delete-pages', 'pdf-rotate-pages', 'pdf-merger', 'pdf-extract-pages'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-rotate-pages', 'pdf-tools', 'pdf', 'rotate', ['rotate pdf', 'turn pdf pages', 'fix pdf orientation', 'تدوير pdf'], ['pdf-reorder-pages', 'pdf-delete-pages', 'pdf-to-images', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-extract-pages', 'pdf-tools', 'pdf', 'file-output', ['extract pdf pages', 'get pages from pdf', 'pdf page extractor', 'استخراج صفحات pdf'], ['pdf-splitter', 'pdf-delete-pages', 'pdf-merger', 'pdf-to-images'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-protect', 'pdf-tools', 'pdf', 'lock', ['protect pdf', 'password pdf', 'encrypt pdf', 'secure pdf', 'حماية pdf بكلمة مرور'], ['pdf-unlock', 'pdf-compressor', 'pdf-merger', 'pdf-page-counter'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-unlock', 'pdf-tools', 'pdf', 'unlock', ['unlock pdf', 'remove pdf password', 'decrypt pdf', 'فك حماية pdf'], ['pdf-protect', 'pdf-merger', 'pdf-splitter', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'] }),
  N('pdf-to-images', 'pdf-tools', 'pdf', 'image-down', ['pdf to jpg', 'pdf to png', 'convert pdf to image', 'pdf إلى صور'], ['images-to-pdf', 'pdf-extract-pages', 'pdf-compressor', 'image-compressor'], { inputFormats: ['pdf'], outputFormats: ['jpg', 'png', 'zip'], maxFileSizeMB: 50, popular: true }),
  N('pdf-compressor', 'pdf-tools', 'pdf', 'gauge', ['compress pdf', 'reduce pdf size', 'shrink pdf', 'ضغط pdf'], ['pdf-merger', 'pdf-to-images', 'pdf-splitter', 'image-compressor'], { inputFormats: ['pdf'], outputFormats: ['pdf'], popular: true }),
  N('pdf-page-counter', 'pdf-tools', 'pdf', 'hash', ['count pdf pages', 'pdf page count', 'how many pages', 'عدد صفحات pdf'], ['pdf-splitter', 'pdf-merger', 'pdf-extract-pages', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: [], maxFileSizeMB: 50, maxFiles: 20 }),
];

const TEXT_TOOLS: ToolDef[] = [
  N('word-counter', 'text-tools', 'text', 'type', ['word counter', 'character count', 'reading time', 'text statistics', 'عداد الكلمات'], ['remove-extra-spaces', 'case-converter', 'text-cleaner', 'remove-duplicate-lines'], { popular: true }),
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
 * Format-specific converters keep their strict inputs; dedicated HEIC
 * converters are registered below instead.
 */
const STRICT_CONVERTERS = new Set([
  'jpg-to-png',
  'png-to-jpg',
  'jpg-to-webp',
  'png-to-webp',
  'webp-to-jpg',
  'webp-to-png',
]);

for (const tool of IMAGE_TOOLS) {
  if (!STRICT_CONVERTERS.has(tool.slug)) {
    tool.inputFormats = [...tool.inputFormats, 'heic', 'heif'];
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
  if (extra) tool.relatedTools = [...extra, ...tool.relatedTools].slice(0, 6);
}

const NEW_IMAGE_TOOLS: ToolDef[] = [
  {
    ...T(
      'heic-to-jpg',
      'convert',
      'repeat',
      ['heic to jpg', 'heif to jpg', 'iphone photo converter', 'convert heic', 'heic2jpg', 'تحويل heic الى jpg', 'صور الايفون'],
      ['heic', 'heif'],
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
      ['heic', 'heif'],
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
      ['jpg', 'png', 'webp', 'heic'],
      ['txt'],
      ['pdf-ocr', 'pdf-to-text', 'word-counter', 'heic-to-jpg'],
      true,
      5,
    ),
    isNew: true,
  },
];

const NEW_PDF_TOOLS: ToolDef[] = [
  N('pdf-to-text', 'pdf-tools', 'pdf', 'file-text', ['pdf to text', 'extract text from pdf', 'pdf to txt', 'copy text pdf', 'استخراج النص من pdf'], ['pdf-to-word', 'pdf-ocr', 'pdf-to-images', 'word-counter'], { inputFormats: ['pdf'], outputFormats: ['txt', 'zip'], maxFileSizeMB: 50, maxFiles: 5, popular: true }),
  N('pdf-to-word', 'pdf-tools', 'pdf', 'file-type', ['pdf to word', 'pdf to doc', 'convert pdf editable', 'pdf word converter', 'تحويل pdf الى وورد'], ['pdf-to-text', 'pdf-ocr', 'pdf-merger', 'text-to-slug'], { inputFormats: ['pdf'], outputFormats: ['doc', 'zip'], maxFileSizeMB: 50, maxFiles: 5, popular: true }),
  N('pdf-ocr', 'pdf-tools', 'pdf', 'scan-text', ['pdf ocr', 'scanned pdf to text', 'ocr pdf online', 'searchable pdf text', 'pdf ممسوح ضوئيا نص'], ['image-ocr', 'pdf-to-text', 'pdf-to-images', 'pdf-compressor'], { inputFormats: ['pdf'], outputFormats: ['txt', 'zip'], maxFileSizeMB: 50, maxFiles: 3 }),
];

const NEW_DEVELOPER_TOOLS: ToolDef[] = [
  N('jwt-decoder', 'developer-tools', 'developer', 'key-round', ['jwt decoder', 'jwt debugger', 'decode token', 'json web token', 'verify jwt', 'فك تشفير jwt'], ['base64-encoder-decoder', 'json-formatter', 'hash-generator', 'url-encoder-decoder'], { popular: true }),
  N('sql-formatter', 'developer-tools', 'developer', 'database', ['sql formatter', 'format sql', 'beautify sql', 'sql minify', 'تنسيق sql'], ['json-formatter', 'xml-formatter', 'text-cleaner', 'javascript-formatter'], {}),
  N('yaml-formatter', 'developer-tools', 'developer', 'file-json', ['yaml formatter', 'yaml validator', 'yaml to json', 'beautify yaml', 'تنسيق yaml'], ['json-formatter', 'xml-formatter', 'markdown-formatter', 'javascript-formatter'], {}),
  N('markdown-formatter', 'developer-tools', 'developer', 'book-open', ['markdown formatter', 'format markdown', 'prettify md', 'markdown preview', 'تنسيق ماركداون'], ['html-encoder-decoder', 'text-to-slug', 'json-formatter', 'lorem-ipsum-generator'], { popular: true }),
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

export const TOOLS: ToolDef[] = [
  ...IMAGE_TOOLS,
  ...NEW_IMAGE_TOOLS,
  ...PDF_TOOLS,
  ...NEW_PDF_TOOLS,
  ...TEXT_TOOLS,
  ...CALCULATOR_TOOLS,
  ...DEVELOPER_TOOLS,
  ...NEW_DEVELOPER_TOOLS,
];

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
  return TOOLS.filter((t) => t.isNew && t.popular).slice(0, limit);
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
