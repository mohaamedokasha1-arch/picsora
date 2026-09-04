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
import { mimeFromExt } from '@/lib/image/format';

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
 * Structural checks on the file name itself — run before any byte is read.
 * Catches path traversal, null-byte truncation, RTL-override spoofing and
 * double extensions.
 */
function validateFilename(name: string): ValidationResult {
  if (!name || name.length > MAX_FILENAME_LENGTH) {
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
  const nameCheck = validateFilename(file.name);
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
  // Extension check
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!rule.extensions.includes(ext as UploadExtension)) {
    return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
  }
  // PDF: verify the %PDF magic bytes instead of the image sniffer.
  if (ext === 'pdf') {
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    const magic = String.fromCharCode(...head.subarray(0, 4));
    if (magic !== '%PDF') return { valid: false, errorKey: 'invalidPdf' };
    return { valid: true };
  }

  // Magic-byte verification (defense in depth). Alias groups such as
  // jpg/jpeg and heic/heif are treated as interchangeable.
  const normalizeAlias = (v: string) => {
    if (v === 'jpeg') return 'jpg';
    if (v === 'heif') return 'heic';
    if (v === 'tif') return 'tiff';
    return v;
  };
  const { sniffFormat } = await import('@/lib/image/format');
  const sniffed = await sniffFormat(file);
  // A null sniff (e.g. an uncommon HEIC brand) lets the decoder attempt a
  // local conversion instead of rejecting the file outright.
  if (sniffed && normalizeAlias(sniffed) !== normalizeAlias(ext)) {
    return { valid: false, errorKey: 'mimeMismatch' };
  }
  // Polyglot guard: a file that *sniffs* as SVG (i.e. is really XML/markup)
  // must never be accepted by a tool that did not ask for SVG, whatever its
  // extension or reported MIME type says.
  if (sniffed === 'svg' && !rule.extensions.includes('svg')) {
    return { valid: false, errorKey: 'mimeMismatch' };
  }
  // Active-content scan for the tools that do accept SVG.
  if (normalizeAlias(ext) === 'svg' || sniffed === 'svg') {
    const svgCheck = await validateSvgContent(file);
    if (!svgCheck.valid) return { ...svgCheck, params: { types: rule.label, ...svgCheck.params } };
  }
  // MIME check (do not trust extension alone)
  if (file.type && file.type !== 'application/octet-stream') {
    // A reported MIME type must itself be well-formed — some browsers pass the
    // value straight through from the OS.
    if (!/^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i.test(file.type)) {
      return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
    }
    const accepted = rule.mimes.some((m) => file.type === m);
    if (!accepted) {
      // If MIME is not in the accepted list but the extension+sniff passed, be lenient
      // (browsers sometimes report generic MIME types). Only reject clearly wrong MIME.
      const clearlyWrong =
        /^(application\/pdf|text\/|audio\/|video\/|application\/(javascript|x-msdownload|x-sh|x-httpd-php|xhtml\+xml|zip|x-zip))/.test(
          file.type,
        );
      if (clearlyWrong) {
        return { valid: false, errorKey: 'invalidType', params: { types: rule.label } };
      }
    }
  }
  return { valid: true };
}

/**
 * Validate a whole batch: per-file rules plus the batch-level limits
 * (file count and combined size) that prevent memory-exhaustion attempts.
 */
export async function validateFiles(
  files: File[],
  rule: FormatRule,
): Promise<ValidationResult & { file?: string }> {
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
  return { valid: true };
}

export function defaultRuleFor(extensions: UploadExtension[], maxFiles = 10, maxFileSizeMB = 50): FormatRule {
  const mimes = extensions.map((e) => mimeFromExt(e));
  const label = extensions.map((e) => e.toUpperCase()).join(', ');
  return { extensions, mimes, label, maxFileSizeMB, maxFiles };
}
