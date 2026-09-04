import type { ImageFormat } from '@/lib/types';
import {
  extAliasList,
  extFromMime,
  isImageFormat,
  isImageMime,
  looksLikePdf,
  mimeFromExt,
  normalizeExt,
  normalizeMime,
  sniffFormat,
} from '@/lib/image/format';

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
  | 'ico';

export interface FormatRule {
  /** Accepted formats (by extension). */
  extensions: UploadExtension[];
  /** Accepted MIME types. */
  mimes: string[];
  /** Human-readable label of accepted formats. */
  label: string;
  maxFileSizeMB: number;
  maxFiles: number;
  /**
   * Ready-to-use value for `<input type="file" accept>`.
   *
   * Deliberately broad: mobile pickers (iOS Photos, Android SAF, Samsung
   * Gallery, WhatsApp/Telegram shares) *hide or grey out* files whose reported
   * MIME type is missing or non-standard when `accept` only lists strict types
   * such as `image/jpeg,image/png`. Adding the `image/*` wildcard plus explicit
   * extension tokens keeps every photo selectable while still steering desktop
   * users towards the right files.
   */
  accept: string;
  /** True when the rule accepts images (as opposed to PDF-only tools). */
  acceptsImages: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errorKey?: string;
  params?: Record<string, string | number>;
}

/** MIME types that are never an image/PDF upload we can handle. */
const CLEARLY_NOT_IMAGE = /^(text\/|audio\/|video\/|application\/(zip|x-zip|msword|vnd\.|x-7z|x-rar|json|javascript|x-shockwave)|multipart\/)/i;

/**
 * Validate a single file against a tool's format rule.
 *
 * The old implementation demanded that the *extension*, the *MIME type* and the
 * *magic bytes* all agree, which silently rejects a large share of perfectly
 * good mobile photos:
 *   - iPhone/Android HEIC + HEIF shots (`.heic`, or `.jpg` with `image/heic`);
 *   - WhatsApp/Telegram downloads (`.jfif`, PNG content inside a `.jpg` name);
 *   - Android SAF / gallery picks that report no extension or an empty MIME;
 *   - `.tif` files whose sniffed form is `tiff` (alias mismatch);
 *   - scans and screenshots re-encoded by the OS with a stale label.
 *
 * The new logic is evidence based: a file is accepted as soon as *any* signal
 * (extension incl. aliases, MIME type, or the real magic bytes) says it is one
 * of the accepted formats — and, for image tools, any genuine image is let
 * through because the browser decodes and re-encodes it anyway. Rejection only
 * happens when the evidence positively says "this is not an image / not a PDF".
 */
export async function validateFile(file: File, rule: FormatRule): Promise<ValidationResult> {
  // 0-byte check
  if (!file || !file.size) {
    return { valid: false, errorKey: 'emptyFile' };
  }
  // Size check
  if (file.size > rule.maxFileSizeMB * 1024 * 1024) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }

  const accepted = acceptedFormats(rule);
  const rawExt = extensionOf(file.name);
  const ext = normalizeExt(rawExt);
  const mime = normalizeMime(file.type);
  const mimeExt = normalizeExt(extFromMime(mime));

  // Read the real content once — it is the strongest signal we have.
  const sniffed = normalizeExt(await sniffFormat(file));

  // ---------------------------------------------------------------- PDF tools
  if (!rule.acceptsImages) {
    // The %PDF magic bytes are the source of truth: file names and MIME types
    // from cloud pickers (Drive, iCloud, WhatsApp) are frequently missing or
    // reported as `application/octet-stream`.
    if (await looksLikePdf(file)) return { valid: true };
    const claimsPdf = ext === 'pdf' || mimeExt === 'pdf' || mime === 'application/pdf';
    if (claimsPdf) {
      // Labelled as PDF but the content is not → precise, actionable error.
      return { valid: false, errorKey: 'invalidPdf' };
    }
    return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
  }

  // -------------------------------------------------------------- Image tools
  const extOk = !!ext && accepted.has(ext);
  const mimeOk = !!mimeExt && accepted.has(mimeExt);
  const sniffOk = !!sniffed && accepted.has(sniffed);

  // 1) A hard "no": the content is verifiably a PDF or another non-image file.
  if (sniffed === 'pdf') {
    return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
  }

  // 2) Any positive signal → accept.
  if (extOk || mimeOk || sniffOk) return { valid: true };

  // 3) The browser/OS says it is an image (`image/heic`, `image/x-foo`, …) even
  //    though we do not know that exact format: accept and let the decoder try.
  if (isImageMime(mime)) return { valid: true };

  // 4) No extension and no usable MIME (very common on Android/iOS pickers) but
  //    the magic bytes are unmistakably an image → accept.
  if (sniffed && isImageFormat(sniffed)) return { valid: true };

  // 5) Nothing matched. Only reject when the evidence is clearly against an
  //    image; an unlabelled, unrecognised file is given the benefit of the doubt
  //    because the browser's own decoder is the final judge.
  if (mime && CLEARLY_NOT_IMAGE.test(mime)) {
    return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
  }
  if (!rawExt && !mime) {
    // Truly opaque blob — let the decode step produce an honest error instead.
    return { valid: true };
  }

  return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
}

/** Lowest extension in a filename, or `''` when there is none. */
export function extensionOf(name: string): string {
  const base = (name || '').split(/[\\/]/).pop() || '';
  const idx = base.lastIndexOf('.');
  // A leading dot (`.htaccess`) or no dot at all means "no extension".
  if (idx <= 0) return '';
  return base.slice(idx + 1).toLowerCase();
}

/** Canonical set of formats a rule accepts, aliases collapsed. */
export function acceptedFormats(rule: FormatRule): Set<string> {
  return new Set(rule.extensions.map((e) => normalizeExt(e)));
}

/** True when a file is (or may be) an HEIC/HEIF photo from an Apple device. */
export async function isHeifFile(file: File): Promise<boolean> {
  if (normalizeExt(extensionOf(file.name)) === 'heif') return true;
  if (normalizeExt(extFromMime(normalizeMime(file.type))) === 'heif') return true;
  return normalizeExt(await sniffFormat(file)) === 'heif';
}

/** Does this rule accept images (rather than being PDF-only)? */
function ruleAcceptsImages(extensions: UploadExtension[]): boolean {
  return extensions.some((e) => normalizeExt(e) !== 'pdf');
}

/**
 * Build the `accept` attribute: broad image wildcard + explicit MIME types +
 * explicit extension tokens (including mobile spellings such as `.heic`).
 */
export function buildAccept(extensions: UploadExtension[], acceptsImages: boolean): string {
  const tokens: string[] = [];
  if (acceptsImages) tokens.push('image/*');

  const mimes = new Set<string>();
  const exts = new Set<string>();
  for (const raw of extensions) {
    const canonical = normalizeExt(raw);
    if (!canonical) continue;
    const mime = mimeFromExt(canonical);
    if (mime && mime !== 'application/octet-stream') mimes.add(mime);
    // Every known spelling, so pickers matching on extension show all photos.
    for (const alias of extAliasList(canonical)) exts.add(`.${alias}`);
    exts.add(`.${canonical}`);
  }
  // Always offer the Apple formats on image tools: iPhones produce them and a
  // strict `accept` list makes those photos unselectable in the picker.
  if (acceptsImages) {
    mimes.add('image/heic');
    mimes.add('image/heif');
    exts.add('.heic');
    exts.add('.heif');
  }

  tokens.push(...mimes, ...exts);
  // De-dupe while preserving order.
  return Array.from(new Set(tokens)).join(',');
}

export function defaultRuleFor(extensions: UploadExtension[], maxFiles = 10, maxFileSizeMB = 50): FormatRule {
  const acceptsImages = ruleAcceptsImages(extensions);
  const mimes = Array.from(
    new Set(
      extensions
        .map((e) => mimeFromExt(e))
        .filter((m) => m && m !== 'application/octet-stream'),
    ),
  );
  const label = Array.from(new Set(extensions.map((e) => normalizeExt(e).toUpperCase()))).join(', ');
  return {
    extensions,
    mimes,
    label,
    maxFileSizeMB,
    maxFiles,
    accept: buildAccept(extensions, acceptsImages),
    acceptsImages,
  };
}
