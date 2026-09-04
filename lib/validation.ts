import type { ImageFormat } from '@/lib/types';
import type { CanonicalImageFormat } from '@/lib/image/format';
import {
  canonicalImageFormat,
  extensionsForFormat,
  fileExt,
  inspectFile,
  mimeForFormat,
  normalizeMime,
} from '@/lib/image/format';

/**
 * Extensions the uploader can accept. Any spelling of a supported image family
 * is allowed (`jpg`/`jpeg`/`jfif`, `tif`/`tiff`, `heic`/`heif`, …) plus `pdf`
 * for the PDF tools.
 */
export type UploadExtension =
  | ImageFormat
  | CanonicalImageFormat
  | 'jpeg'
  | 'jpe'
  | 'jif'
  | 'jfi'
  | 'jfif'
  | 'apng'
  | 'dib'
  | 'tif'
  | 'heif'
  | 'heics'
  | 'heifs'
  | 'hif'
  | 'avifs'
  | 'svgz'
  | 'cur'
  | 'pdf';

export interface FormatRule {
  /** Accepted formats (by extension). */
  extensions: UploadExtension[];
  /** Accepted MIME types. */
  mimes: string[];
  /** Human-readable label of accepted formats. */
  label: string;
  maxFileSizeMB: number;
  maxFiles: number;
  /** Canonical image families this rule accepts. Empty for PDF-only tools. */
  formats: CanonicalImageFormat[];
  /** Whether this rule accepts PDF input. */
  acceptsPdf: boolean;
  /** Ready-to-use value for the `<input accept>` attribute. */
  accept: string;
}

export interface ValidationResult {
  valid: boolean;
  errorKey?: string;
  params?: Record<string, string | number>;
}

/**
 * MIME families that are definitively not an image. Only used to overrule a
 * filename extension, so it is kept narrow on purpose.
 */
const NON_IMAGE_MIME =
  /^(application\/(pdf|zip|x-|java|msword|vnd\.|json|xml)|text\/|audio\/|video\/|multipart\/)/;

/** Build the `<input accept>` list: MIME types plus extension spellings. */
function buildAccept(formats: CanonicalImageFormat[], acceptsPdf: boolean): { mimes: string[]; accept: string } {
  const mimes: string[] = [];
  const exts: string[] = [];

  for (const format of formats) {
    const mime = mimeForFormat(format);
    if (mime && !mimes.includes(mime)) mimes.push(mime);
    for (const ext of extensionsForFormat(format)) exts.push(`.${ext}`);
  }

  // Browsers on Android/iOS filter the picker by the accept list, and several of
  // them only match reliably when both a wildcard and the explicit extensions
  // are present. Including `image/*` stops camera-roll photos from being
  // greyed out when the OS reports an unusual MIME type.
  if (formats.length > 0 && !mimes.includes('image/*')) mimes.push('image/*');
  if (acceptsPdf) {
    mimes.push('application/pdf');
    exts.push('.pdf');
  }

  return { mimes, accept: [...mimes, ...exts].join(',') };
}

/**
 * Validate a single file against a tool's format rule.
 *
 * The order of evidence is deliberate: the file's **bytes** are trusted first,
 * then the **MIME type**, then the **filename extension** — because mobile
 * cameras, messengers and download managers routinely hand us files with a
 * missing, upper-case, double or simply wrong extension, and rejecting on the
 * name alone is what produced spurious "unsupported file type" errors.
 */
export async function validateFile(file: File, rule: FormatRule): Promise<ValidationResult> {
  const notSupported: ValidationResult = {
    valid: false,
    errorKey: 'invalidType',
    params: { types: rule.label },
  };

  if (!file) return notSupported;

  // 0-byte check
  if (!file.size) {
    return { valid: false, errorKey: 'emptyFile' };
  }
  // Size check
  if (file.size > rule.maxFileSizeMB * 1024 * 1024) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }

  const ext = fileExt(file.name);
  const mime = normalizeMime(file.type);
  const extFormat = canonicalImageFormat(ext);
  const claimsPdf = ext === 'pdf' || mime === 'application/pdf';

  // PDF tools: the %PDF magic bytes are authoritative. Downloads from scanners
  // and messaging apps frequently arrive with no extension at all, or labelled
  // `application/octet-stream`, so the name and MIME are only used to pick the
  // error message — never to decide whether the file is a PDF.
  if (rule.acceptsPdf) {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head.subarray(0, 4)) === '%PDF') return { valid: true };
    if (claimsPdf) return { valid: false, errorKey: 'invalidPdf' };
    // Otherwise fall through, so an image dropped on a PDF tool reports the
    // generic "unsupported type" message instead of "not a valid PDF".
  }

  // Read the magic bytes once — this is the strongest signal we have.
  const inspection = await inspectFile(file);

  // 1. The bytes match a real image signature.
  if (inspection.image) {
    // The tool handles images and the content is a genuine image: accept it.
    // A PNG that happens to be named `.jpg` still decodes and re-encodes
    // perfectly, so refusing it only produced false errors.
    if (rule.formats.length > 0) return { valid: true };
    // PDF-only tool handed an image.
    return notSupported;
  }

  // 2. The bytes match a known non-image signature (executable, script, …).
  //    This is what actually keeps a renamed `evil.jpg` out.
  if (inspection.nonImage) return notSupported;

  // 3. No recognised signature — fall back to MIME, then filename.
  if (rule.formats.length > 0) {
    // A platform-declared image MIME is trusted even when our signature table
    // has no match; the decode step produces a precise error if it is broken.
    if (mime.startsWith('image/')) return { valid: true };
    // A MIME that positively says "not an image" overrides the filename.
    if (NON_IMAGE_MIME.test(mime)) return notSupported;
    // Otherwise the filename extension is good enough evidence.
    if (extFormat) return { valid: true };
    // Nothing to go on (common for Android content URIs with neither an
    // extension nor a MIME type). Let the browser's decoder be the judge rather
    // than guessing "unsupported".
    if (!inspection.inconclusive) return { valid: true };
  }

  return notSupported;
}

export function defaultRuleFor(extensions: UploadExtension[], maxFiles = 10, maxFileSizeMB = 50): FormatRule {
  const formats: CanonicalImageFormat[] = [];
  let acceptsPdf = false;

  for (const ext of extensions) {
    const lowered = String(ext).toLowerCase();
    if (lowered === 'pdf') {
      acceptsPdf = true;
      continue;
    }
    const canonical = canonicalImageFormat(lowered);
    if (canonical && !formats.includes(canonical)) formats.push(canonical);
  }

  const { mimes, accept } = buildAccept(formats, acceptsPdf);
  const labelParts: string[] = [];
  for (const format of formats) {
    const upper = format.toUpperCase();
    if (!labelParts.includes(upper)) labelParts.push(upper);
  }
  if (acceptsPdf) labelParts.push('PDF');
  const label = labelParts.join(', ');

  return { extensions, mimes, label, maxFileSizeMB, maxFiles, formats, acceptsPdf, accept };
}
