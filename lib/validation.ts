import type { ImageFormat } from '@/lib/types';

/** Extensions the uploader can accept (images plus PDF for the PDF tools). */
export type UploadExtension = ImageFormat | 'pdf' | 'bmp' | 'tiff' | 'tif' | 'avif' | 'svg';

import { mimeFromExt, sniffFormat } from '@/lib/image/format';

export interface FormatRule {
  /** Accepted formats (by extension). */
  extensions: UploadExtension[];
  /** Accepted MIME types. */
  mimes: string[];
  /** Human-readable label of accepted formats. */
  label: string;
  maxFileSizeMB: number;
  maxFiles: number;
}

export interface ValidationResult {
  valid: boolean;
  errorKey?: string;
  params?: Record<string, string | number>;
}

/**
 * Canonical extension for a filename. Mobile apps, cameras and browsers are
 * inconsistent about casing and suffixes, so we fold common aliases together:
 *   .jpeg / .jfif / .jpg -> "jpg", .tif -> "tiff", etc.
 */
const EXT_ALIASES: Record<string, string> = {
  jpg: 'jpg',
  jpeg: 'jpg',
  jfif: 'jpg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  bmp: 'bmp',
  tif: 'tiff',
  tiff: 'tiff',
  avif: 'avif',
  heic: 'heic',
  heif: 'heif',
  svg: 'svg',
  pdf: 'pdf',
};

/** Canonical MIME aliases reported by different browsers / mobile OSes. */
const MIME_ALIASES: Record<string, string> = {
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/x-citrix-png': 'image/png',
  'image/x-ms-bmp': 'image/bmp',
  'image/x-bmp': 'image/bmp',
  'image/svg': 'image/svg+xml',
  'image/heif': 'image/heic',
};

/** Normalise a MIME type: lowercase, strip parameters (e.g. ";charset=utf-8") and fold aliases. */
export function normalizeMime(mime: string): string {
  const base = (mime || '').split(';')[0].trim().toLowerCase();
  return MIME_ALIASES[base] || base;
}

/** Canonical extension for a file name (lowercased + alias-folded). */
export function canonicalExt(name: string): string {
  const raw = (name.split('.').pop() || '').toLowerCase();
  return EXT_ALIASES[raw] || raw;
}

/** Whether a (raw) MIME type is any image type, e.g. "image/jpeg", "image/heic". */
export function isImageMime(mime: string): boolean {
  return normalizeMime(mime).startsWith('image/');
}

/**
 * Validate a single file against a tool's format rule.
 *
 * The policy is intentionally lenient for image tools: browsers (especially on
 * mobile) report inconsistent MIME types and extensions for perfectly valid
 * photos, so we accept any recognised image and only reject content that is
 * clearly not an image. PDF tools keep the strict `%PDF` magic-byte check.
 */
export async function validateFile(file: File, rule: FormatRule): Promise<ValidationResult> {
  // 0-byte check
  if (!file.size) {
    return { valid: false, errorKey: 'emptyFile' };
  }
  // Size check
  if (file.size > rule.maxFileSizeMB * 1024 * 1024) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }

  const ext = canonicalExt(file.name);
  const mime = normalizeMime(file.type);
  const acceptsPdf = rule.extensions.includes('pdf');
  const acceptsImages = rule.extensions.some((e) => e !== 'pdf');
  const acceptedExts = new Set(rule.extensions.map((e) => canonicalExt(e)));

  // PDF-only rule (the PDF tools): keep the strict signature check.
  if (acceptsPdf && !acceptsImages) {
    if (ext !== 'pdf') {
      return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
    }
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const magic = String.fromCharCode(...head.subarray(0, 4));
    if (magic !== '%PDF') return { valid: false, errorKey: 'invalidPdf' };
    return { valid: true };
  }

  // Image rule. Reject only content that is clearly not an image.
  if (mime && mime !== 'application/octet-stream' && !isImageMime(mime)) {
    // e.g. a PDF or text file dragged into an image tool.
    return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
  }

  // Content sniffed as a real image (jpg/png/webp/gif/bmp/tiff/avif/svg).
  // This is the strongest signal — trust it even if the extension or MIME is
  // misreported (very common with phone cameras and messaging apps).
  const sniffed = await sniffFormat(file);
  if (sniffed) {
    return { valid: true };
  }

  // Extension matches an accepted image format (covers empty/odd MIME types,
  // e.g. files reported as application/octet-stream by Android/WhatsApp).
  if (acceptedExts.has(ext)) {
    return { valid: true };
  }

  // Any image/* MIME is accepted (mobile browsers report varying MIME types).
  if (isImageMime(mime)) {
    return { valid: true };
  }

  // Couldn't identify this as an image at all.
  return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
}

export function defaultRuleFor(extensions: UploadExtension[], maxFiles = 10, maxFileSizeMB = 50): FormatRule {
  const mimes = extensions.map((e) => mimeFromExt(e));
  const label = extensions.map((e) => e.toUpperCase()).join(', ');
  return { extensions, mimes, label, maxFileSizeMB, maxFiles };
}

/** `accept` attribute for the file input, tuned per rule for mobile pickers. */
export function acceptAttrFor(rule: FormatRule): string {
  const acceptsPdf = rule.extensions.includes('pdf');
  const acceptsImages = rule.extensions.some((e) => e !== 'pdf');
  if (acceptsPdf && !acceptsImages) return 'application/pdf,.pdf';
  if (acceptsImages && !acceptsPdf) return 'image/*';
  // Mixed (shouldn't happen in practice) — fall back to explicit values.
  return [...rule.mimes, ...rule.extensions.map((e) => `.${e}`)].join(',');
}
