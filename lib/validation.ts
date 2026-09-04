import type { ImageFormat } from '@/lib/types';
import {
  canonicalFormatFromExt,
  canonicalFormatFromMime,
  extensionsForFormat,
  fileExt,
  isImageExt,
  isImageMime,
  mimeFromExt,
  sniffFormat,
} from '@/lib/image/format';
import type { CanonicalFormat } from '@/lib/image/format';

/** Extensions the uploader can accept (images plus PDF for the PDF tools). */
export type UploadExtension =
  | ImageFormat
  | 'pdf'
  | 'bmp'
  | 'tiff'
  | 'tif'
  | 'avif'
  | 'svg'
  | 'heic'
  | 'heif'
  | 'jfif'
  | 'jpe'
  | 'pjpeg'
  | 'apng';

export interface FormatRule {
  /** Accepted formats (by extension). */
  extensions: UploadExtension[];
  /** Accepted MIME types. */
  mimes: string[];
  /**
   * Ready-to-use value for `<input accept>`.
   *
   * It combines `image/*`, the concrete MIME types *and* the file extensions.
   * That redundancy is deliberate: several Android file managers and iOS
   * pickers only match one of the three forms, and when nothing matches they
   * grey out perfectly good photos instead of letting the user pick them.
   */
  accept: string;
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

const invalidType = (rule: FormatRule): ValidationResult => ({
  valid: false,
  errorKey: 'invalidType',
  params: { types: rule.label },
});

/** The canonical formats a rule really accepts, with all aliases folded in. */
export function allowedFormats(rule: FormatRule): Set<CanonicalFormat> {
  const set = new Set<CanonicalFormat>();
  rule.extensions.forEach((ext) => {
    const canonical = canonicalFormatFromExt(ext);
    if (canonical) set.add(canonical);
  });
  return set;
}

/** True when a MIME type advertises a concrete, definitely-not-an-image family. */
function isClearlyNotAnImage(mime: string): boolean {
  if (!mime) return false;
  if (mime.startsWith('image/')) return false;
  // Generic buckets carry no information — phones use them for real photos.
  if (mime === 'application/octet-stream' || mime === 'binary/octet-stream' || mime === 'application/x-empty') {
    return false;
  }
  return /^(text|audio|video|font|model|multipart|message|application)\//.test(mime);
}

/**
 * Check the `%PDF` magic bytes.
 *
 * The header is searched within the first kilobyte rather than required at
 * offset 0: plenty of real PDFs carry a byte-order mark or a little leading
 * junk, and rejecting those used to produce bogus "not a valid PDF" errors.
 */
export async function hasPdfMagic(file: File): Promise<boolean> {
  try {
    const head = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
    if (head.length < 4) return false;
    let run = 0;
    for (let i = 0; i < head.length; i++) {
      const expected = '%PDF'[run];
      if (head[i] === expected.charCodeAt(0)) {
        run += 1;
        if (run === 4) return true;
      } else {
        run = head[i] === '%'.charCodeAt(0) ? 1 : 0;
      }
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Validate a single file against a tool's format rule.
 *
 * The rule of thumb here is "content wins, and when in doubt, let it through":
 * the filename and the MIME type are both unreliable on mobile (camera
 * captures arrive as `IMG_20260904_120000`, `blob` or `image` with an empty or
 * generic MIME type), so they are treated as *hints*. The magic bytes are the
 * fallback, and only a file that positively identifies as something the tool
 * cannot handle is rejected. Anything still ambiguous goes to the decoder,
 * which reports an honest "couldn't read this image" instead of a made-up
 * "unsupported file type".
 */
export async function validateFile(file: File, rule: FormatRule): Promise<ValidationResult> {
  if (!file) return { valid: false, errorKey: 'noFile' };

  // 0-byte check
  if (!file.size) {
    return { valid: false, errorKey: 'emptyFile' };
  }
  // Size check
  if (file.size > rule.maxFileSizeMB * 1024 * 1024) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }

  const allowed = allowedFormats(rule);
  const mime = (file.type || '').trim().toLowerCase().split(';')[0].trim();

  // What the file claims to be: extension first, then MIME type.
  const ext = fileExt(file.name);
  const claimed = canonicalFormatFromExt(ext) || canonicalFormatFromMime(mime);

  // --- PDF ------------------------------------------------------------------
  if (claimed === 'pdf') {
    if (!allowed.has('pdf')) return invalidType(rule);
    return (await hasPdfMagic(file)) ? { valid: true } : { valid: false, errorKey: 'invalidPdf' };
  }
  // --- An accepted image format, by name or by MIME -------------------------
  if (claimed && allowed.has(claimed)) {
    // Defense in depth: a document or archive renamed to .jpg is called out
    // here, but a *different image* format is allowed through on purpose —
    // every browser-decodable image can be re-encoded by the tools.
    const sniffed = await sniffFormat(file);
    if (sniffed === 'pdf' && !allowed.has('pdf')) {
      return { valid: false, errorKey: 'mimeMismatch' };
    }
    return { valid: true };
  }

  // --- Inconclusive so far: trust the bytes ---------------------------------
  // This is the branch that rescues mobile uploads with no usable extension.
  const sniffed = await sniffFormat(file);
  if (sniffed) {
    if (allowed.has(sniffed)) return { valid: true };
    if (sniffed === 'pdf') {
      return allowed.has('pdf')
        ? (await hasPdfMagic(file))
          ? { valid: true }
          : { valid: false, errorKey: 'invalidPdf' }
        : invalidType(rule);
    }
    // Positively identified as a format this tool does not accept.
    return invalidType(rule);
  }

  // --- Unrecognized bytes: stay permissive ----------------------------------
  if (isImageMime(mime)) return { valid: true };
  if (ext && isImageExt(ext)) return { valid: true };
  if (isClearlyNotAnImage(mime)) return invalidType(rule);
  // Nothing to go on at all (no name, no MIME, no signature). Let the decoder
  // try — a real image still works, and junk produces an honest read error.
  return { valid: true };
}

/** Build the `accept` attribute for a rule: `image/*` + MIME types + extensions. */
export function buildAcceptAttr(formats: CanonicalFormat[]): string {
  const unique = Array.from(new Set(formats));
  const hasImages = unique.some((f) => f !== 'pdf');
  const mimes = unique.map((f) => mimeFromExt(f)).filter((m) => m !== 'application/octet-stream');
  const exts = unique.flatMap((f) => extensionsForFormat(f)).map((e) => `.${e}`);
  return Array.from(new Set([...(hasImages ? ['image/*'] : []), ...mimes, ...exts])).join(',');
}

/** Display names used in the "Accepted: …" hint and in error messages. */
const DISPLAY_NAME: Record<CanonicalFormat, string> = {
  jpg: 'JPG',
  png: 'PNG',
  webp: 'WEBP',
  gif: 'GIF',
  bmp: 'BMP',
  tiff: 'TIFF',
  avif: 'AVIF',
  heif: 'HEIC',
  svg: 'SVG',
  pdf: 'PDF',
};

export function defaultRuleFor(extensions: UploadExtension[], maxFiles = 10, maxFileSizeMB = 50): FormatRule {
  const formats = Array.from(
    new Set(extensions.map((e) => canonicalFormatFromExt(e)).filter(Boolean)),
  ) as CanonicalFormat[];
  const mimes = Array.from(new Set(formats.map((f) => mimeFromExt(f)))).filter(
    (m) => m !== 'application/octet-stream',
  );
  // Deduplicated so a rule listing both "jpg" and "jpeg" still reads "JPG".
  const label = formats.map((f) => DISPLAY_NAME[f]).join(', ') || extensions.join(', ').toUpperCase();
  return {
    extensions,
    mimes,
    accept: buildAcceptAttr(formats),
    label,
    maxFileSizeMB,
    maxFiles,
  };
}
