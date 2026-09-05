import type { ImageFormat } from '@/lib/types';

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
  | 'heif';
import {
  detectFileFormat,
  extFromMime,
  fileExt,
  mimeFromExt,
  normalizeFormatAlias,
  sniffFormat,
  stripExtension,
} from '@/lib/image/format';

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

/** Hard ceiling regardless of the per-tool rule (tab-crash / OOM protection). */
const ABSOLUTE_MAX_BYTES = 512 * 1024 * 1024;
/** Longest file name we will process; longer names are almost always attacks. */
const MAX_FILENAME_LENGTH = 255;

/**
 * Executable / script-bearing extensions. A file may not end with one of
 * these, and the high-confidence subset below may not appear anywhere in the
 * name (`photo.exe.png`) — the classic double-extension trick used to slip a
 * payload past a naive check.
 */
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'dll', 'scr', 'com', 'pif', 'msi', 'msix', 'bat', 'cmd', 'ps1', 'psm1',
  'vbs', 'vbe', 'js', 'mjs', 'cjs', 'jse', 'jar', 'sh', 'bash', 'zsh', 'php',
  'phtml', 'php3', 'php4', 'php5', 'phar', 'asp', 'aspx', 'jsp', 'jspx', 'cgi',
  'pl', 'py', 'rb', 'app', 'deb', 'rpm', 'dmg', 'apk', 'lnk', 'reg', 'hta',
  'htm', 'html', 'xhtml', 'shtml', 'svgz', 'wsf', 'scf', 'inf', 'chm',
]);

/**
 * Subset checked in the middle of a name too. Deliberately narrow so ordinary
 * files such as `chart.py.png` from a script are not rejected by accident —
 * only unambiguously executable formats are blocked mid-name.
 */
const DANGEROUS_MIDNAME_EXTENSIONS = new Set([
  'exe', 'dll', 'scr', 'com', 'pif', 'msi', 'bat', 'cmd', 'ps1', 'vbs', 'jse',
  'jar', 'php', 'phtml', 'phar', 'asp', 'aspx', 'jsp', 'hta', 'lnk', 'reg',
  'html', 'htm', 'shtml', 'svgz', 'wsf', 'scf',
]);

// eslint-disable-next-line no-control-regex
const CONTROL_OR_NULL = /[\u0000-\u001F\u007F]/;
/** Bidi overrides used to disguise the real extension of a file. */
const BIDI_SPOOF = /[\u202A-\u202E\u2066-\u2069]/;

/**
 * Reported MIME types that are unambiguously NOT an image/PDF. Used only on
 * the no-content-signal fallback path: when the bytes themselves identify
 * the format, a bogus picker-reported MIME is ignored (content wins).
 */
const CLEARLY_WRONG_MIME =
  /^(application\/pdf|text\/|audio\/|video\/|application\/(javascript|x-msdownload|x-sh|x-httpd-php|xhtml\+xml|zip|x-zip))/;

/** Characters that are illegal or hostile in file names on major OSes. */
// eslint-disable-next-line no-control-regex
const NAME_HOSTILE_CHARS = /[\\/:*?"<>|\u0000-\u001F\u007F-\u009F]/g;
/** Bidi overrides + zero-width invisibles used to spoof file names. */
const NAME_SPOOF_CHARS = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u200B-\u200D\u2060\uFEFF]/g;

/**
 * Structural checks on the file name itself — run before any byte is read.
 * Catches path traversal, null-byte truncation, RTL-override spoofing and
 * double extensions.
 *
 * A MISSING name is explicitly fine: photo-gallery / picker selections on
 * Android and iOS frequently arrive unnamed (`""`) or without any extension
 * (`image:47`, `1000012345`). An absent name carries no traversal or
 * spoofing risk — the content checks in `validateFile` decide the type and
 * `normalizeUploadedFile` gives the file a usable name afterwards.
 */
function validateFilename(name: string): ValidationResult {
  if (!name) {
    return { valid: true };
  }
  if (name.length > MAX_FILENAME_LENGTH) {
    return { valid: false, errorKey: 'invalidType' };
  }
  if (CONTROL_OR_NULL.test(name) || BIDI_SPOOF.test(name)) {
    return { valid: false, errorKey: 'invalidType' };
  }
  // Directory components must never appear in a picked/dropped file name.
  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    return { valid: false, errorKey: 'invalidType' };
  }
  // Any executable extension anywhere in the chain (`a.exe.png`, `a.png.exe`).
  const parts = name.toLowerCase().split('.').slice(1);
  const finalExt = parts[parts.length - 1] ?? '';
  for (const part of parts) {
    // The real (last) extension is validated against the tool's allow-list
    // below; here we only reject dangerous ones hidden mid-name.
    if (part !== finalExt && DANGEROUS_MIDNAME_EXTENSIONS.has(part)) {
      return { valid: false, errorKey: 'invalidType' };
    }
  }
  if (DANGEROUS_EXTENSIONS.has(finalExt)) {
    return { valid: false, errorKey: 'invalidType' };
  }
  return { valid: true };
}

/**
 * Reject SVGs that contain active content. SVG is XML and can carry
 * `<script>`, `onload=` handlers, external entities (XXE) and
 * `xlink:href="javascript:…"`. The tools only ever need static vector art.
 */
async function validateSvgContent(file: File): Promise<ValidationResult> {
  // 2 MB is far beyond any legitimate icon/logo the tools handle.
  if (file.size > 2 * 1024 * 1024) return { valid: false, errorKey: 'fileTooLarge', params: { size: 2 } };
  let text: string;
  try {
    text = await file.slice(0, 512 * 1024).text();
  } catch {
    return { valid: false, errorKey: 'invalidType' };
  }
  const lowered = text.toLowerCase();
  const hostile =
    lowered.includes('<script') ||
    lowered.includes('<foreignobject') ||
    lowered.includes('<!entity') ||
    lowered.includes('<!doctype') ||
    lowered.includes('javascript:') ||
    lowered.includes('data:text/html') ||
    /\son\w+\s*=/.test(lowered) ||
    /<\s*(iframe|embed|object|use\s[^>]*xlink:href\s*=\s*["']?\s*http)/.test(lowered);
  if (hostile) return { valid: false, errorKey: 'invalidType' };
  return { valid: true };
}

/** Validate a single file against a tool's format rule. */
export async function validateFile(file: File, rule: FormatRule): Promise<ValidationResult> {
  // 0 — File name structure (traversal, spoofing, double extensions).
  // An absent name (gallery picks) is fine; a present one must be safe.
  const nameCheck = validateFilename(file.name || '');
  if (!nameCheck.valid) return { ...nameCheck, params: { types: rule.label } };

  // 0-byte check
  if (!file.size) {
    return { valid: false, errorKey: 'emptyFile' };
  }
  // Size check (per-tool rule, then an absolute hard ceiling).
  if (file.size > rule.maxFileSizeMB * 1024 * 1024) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }
  if (file.size > ABSOLUTE_MAX_BYTES) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }
  // ── Type detection: CONTENT-FIRST ────────────────────────────────────────
  // Photo-gallery / picker selections are notoriously sloppy compared to the
  // file manager: names with no extension at all (`image:47`, `1000012345`),
  // empty names, empty or generic MIME types — and galleries transcode on
  // share (iOS hands out JPEG bytes inside a file still named `.HEIC`, some
  // Android galleries flip screenshots between PNG and JPEG). The magic
  // bytes are the only dependable signal, so they get the final word; the
  // extension and MIME type are fallbacks, never gatekeepers.
  const ext = normalizeFormatAlias(fileExt(file.name || ''));
  const mimeExt = normalizeFormatAlias(extFromMime(file.type || ''));
  const sniffedRaw = await sniffFormat(file);
  const sniffed = sniffedRaw ? normalizeFormatAlias(sniffedRaw) : '';
  const ruleFormats = new Set(rule.extensions.map((e) => normalizeFormatAlias(e)));
  const wrongType = (): ValidationResult => ({
    valid: false,
    errorKey: 'invalidType',
    params: { types: rule.label },
  });
  // Keep the `{types}` label on SVG scan failures so the message renders.
  const withTypes = (r: ValidationResult): ValidationResult =>
    r.valid ? r : { ...r, params: { types: rule.label, ...(r.params ?? {}) } };

  // PDF: the %PDF magic bytes decide. A document picker that strips the
  // `.pdf` suffix still delivers a usable PDF; an image tool that receives a
  // PDF gets the usual clear "unsupported type" rejection.
  if (sniffed === 'pdf') {
    return ruleFormats.has('pdf') ? { valid: true } : wrongType();
  }

  // SVG content (i.e. really XML/markup): only tools that asked for SVG may
  // receive it, it must not hide behind a raster extension (polyglot guard),
  // and it must pass the active-content scan.
  if (sniffed === 'svg') {
    if (!ruleFormats.has('svg')) return wrongType();
    if (ext && ext !== 'svg') return { valid: false, errorKey: 'mimeMismatch' };
    return withTypes(await validateSvgContent(file));
  }

  // Raster images: the format identified from the BYTES — not the name —
  // decides acceptance. Extension/MIME disagreements are normal for gallery
  // picks (transcoded HEIC→JPEG, PNG↔JPEG screenshots) and must not reject
  // the file as long as the tool supports the real content; the uploader
  // re-labels such files to match their bytes before processing.
  if (sniffed) {
    return ruleFormats.has(sniffed) ? { valid: true } : wrongType();
  }

  // No content signal at all (e.g. an uncommon container brand the sniffer
  // does not enumerate): fall back to the claimed extension, then the MIME
  // type, and let the decoder attempt instead of rejecting outright — the
  // historic leniency for exotic HEIC files. A PDF claim still requires the
  // magic bytes, and a clearly non-image MIME stays rejected.
  if (ext === 'pdf' || mimeExt === 'pdf') {
    return ruleFormats.has('pdf') ? { valid: false, errorKey: 'invalidPdf' } : wrongType();
  }
  const claim = ruleFormats.has(ext) ? ext : ruleFormats.has(mimeExt) ? mimeExt : '';
  if (!claim) return wrongType();
  if (claim === 'svg') return withTypes(await validateSvgContent(file));
  if (file.type && CLEARLY_WRONG_MIME.test(file.type)) return wrongType();
  return { valid: true };
}

/**
 * Build a safe, usable file name for a picked file: strips path separators
 * and filesystem-hostile characters (gallery names like `image:47`), control
 * and bidi/zero-width spoofing characters, collapses whitespace, and appends
 * the canonical extension of the detected format. Unnamed picks fall back to
 * `image.<ext>`. Human-readable names — including Arabic ones — are kept.
 */
function buildUsableName(originalName: string | undefined, ext: string): string {
  let base = stripExtension(originalName || '')
    .replace(NAME_SPOOF_CHARS, '')
    // eslint-disable-next-line no-control-regex
    .replace(NAME_HOSTILE_CHARS, '_')
    .replace(/^\.+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (base.length > 120) base = base.slice(0, 120).trim();
  return `${base || 'image'}.${ext}`;
}

/**
 * Re-label an accepted file so its NAME and MIME type match its actual
 * CONTENT. Gallery/photo-picker selections routinely arrive mislabelled:
 * JPEG bytes named `.HEIC` (iOS transcodes on share), PNG screenshots named
 * `.jpg` (some Android galleries), names with no extension (`image:47`) or
 * no name and no MIME type at all.
 *
 * Everything downstream — the HEIC-conversion routing, `<img>` previews,
 * canvas encode format selection and output file names — derives the format
 * from name/type, so repairing both here makes gallery picks behave exactly
 * like file-manager picks. File CONTENTS are never touched: `new File([f])`
 * just wraps the same blob. Files that are already consistent are returned
 * unchanged (same reference), so this is idempotent.
 */
export async function normalizeUploadedFile(file: File): Promise<File> {
  const target = await detectFileFormat(file);
  if (!target) return file; // no signal at all — leave as-is, decoder will judge

  const ext = normalizeFormatAlias(fileExt(file.name || ''));
  const extOk = !!ext && ext === target;
  const mime = (file.type || '').toLowerCase();
  const typeOk =
    !!mime && mime !== 'application/octet-stream' && normalizeFormatAlias(extFromMime(mime)) === target;
  if (extOk && typeOk) return file; // already consistent — keep the original object

  const name = extOk ? file.name : buildUsableName(file.name, target);
  try {
    return new File([file], name, {
      type: mimeFromExt(target),
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file; // exotic environment without a usable File constructor
  }
}

/**
 * Validate a whole batch: per-file rules plus the batch-level limits
 * (file count and combined size) that prevent memory-exhaustion attempts.
 * On success the returned `files` are content-normalised copies (see
 * `normalizeUploadedFile`) ready for the processing pipeline.
 */
export async function validateFiles(
  files: File[],
  rule: FormatRule,
): Promise<ValidationResult & { file?: string; files?: File[] }> {
  if (files.length > rule.maxFiles) {
    return { valid: false, errorKey: 'tooManyFiles', params: { max: String(rule.maxFiles) } };
  }
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const totalCap = Math.min(rule.maxFileSizeMB * rule.maxFiles, 1024) * 1024 * 1024;
  if (totalBytes > totalCap) {
    return { valid: false, errorKey: 'fileTooLarge', params: { size: String(rule.maxFileSizeMB) } };
  }
  for (const file of files) {
    const result = await validateFile(file, rule);
    if (!result.valid) return { ...result, file: file.name };
  }
  const normalized = await Promise.all(files.map((f) => normalizeUploadedFile(f)));
  return { valid: true, files: normalized };
}

export function defaultRuleFor(extensions: UploadExtension[], maxFiles = 10, maxFileSizeMB = 50): FormatRule {
  const mimes = extensions.map((e) => mimeFromExt(e));
  const label = extensions.map((e) => e.toUpperCase()).join(', ');
  return { extensions, mimes, label, maxFileSizeMB, maxFiles };
}
