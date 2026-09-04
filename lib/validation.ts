import type { ImageFormat } from '@/lib/types';
import { mimeFromExt, sniffFormat, isHeicFile } from '@/lib/image/format';

/** Extensions the uploader can accept (images, HEIC, PDF, etc.). */
export type UploadExtension =
  | ImageFormat
  | 'pdf'
  | 'bmp'
  | 'tiff'
  | 'tif'
  | 'avif'
  | 'svg'
  | 'heic'
  | 'heif';

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

/** Validate a single file against a tool's format rule. */
export async function validateFile(file: File, rule: FormatRule): Promise<ValidationResult> {
  // 0-byte check
  if (!file.size) {
    return { valid: false, errorKey: 'emptyFile' };
  }
  // Size check
  if (file.size > rule.maxFileSizeMB * 1024 * 1024) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }

  // Extension check
  const ext = (file.name.split('.').pop() || '').toLowerCase() as UploadExtension;
  const isAcceptedExt = rule.extensions.includes(ext) ||
    (ext === 'jpeg' && rule.extensions.includes('jpg')) ||
    (ext === 'jpg' && rule.extensions.includes('jpeg')) ||
    (ext === 'heif' && rule.extensions.includes('heic')) ||
    (ext === 'heic' && rule.extensions.includes('heif'));

  if (!isAcceptedExt) {
    return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
  }

  // PDF: verify the %PDF magic bytes
  if (ext === 'pdf') {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const magic = String.fromCharCode(...head.subarray(0, 4));
    if (magic !== '%PDF') return { valid: false, errorKey: 'invalidPdf' };
    return { valid: true };
  }

  // HEIC check
  if (isHeicFile(file, ext)) {
    return { valid: true };
  }

  // Magic-byte verification (defense in depth)
  const sniffed = await sniffFormat(file);
  if (sniffed) {
    const matches =
      sniffed === ext ||
      (ext === 'jpeg' && sniffed === 'jpg') ||
      (ext === 'jpg' && sniffed === 'jpeg') ||
      ((ext === 'heic' || ext === 'heif') && (sniffed === 'heic' || sniffed === 'avif'));
    if (!matches) {
      return { valid: false, errorKey: 'mimeMismatch' };
    }
  }

  // MIME check (do not trust extension alone)
  if (file.type && file.type !== 'application/octet-stream') {
    const accepted = rule.mimes.some((m) => file.type === m || file.type.startsWith('image/'));
    if (!accepted) {
      const clearlyWrong = /^(video\/|audio\/|application\/(?!pdf|octet-stream))/.test(file.type);
      if (clearlyWrong) {
        return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
      }
    }
  }

  return { valid: true };
}

export function defaultRuleFor(extensions: UploadExtension[], maxFiles = 10, maxFileSizeMB = 50): FormatRule {
  const mimes = extensions.map((e) => mimeFromExt(e));
  const label = extensions.map((e) => e.toUpperCase()).join(', ');
  return { extensions, mimes, label, maxFileSizeMB, maxFiles };
}
