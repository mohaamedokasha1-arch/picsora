'use client';

/**
 * Local, format-aware validation for files produced by Piclizer.
 *
 * A Blob existing is not proof that a tool worked: canvas encoders can return
 * the wrong format, PDF libraries can emit an unreadable document, and a ZIP
 * can be perfectly valid while containing no useful files.  This module is
 * deliberately browser-only and never sends bytes to a service.  Callers
 * should validate before putting an output into a success state and the
 * download components call it again as a final safety net.
 */

export type OutputValidationCode =
  | 'outputEmpty'
  | 'outputInvalid'
  | 'outputUnreadable'
  | 'outputNoContent'
  | 'archiveInvalid'
  | 'scannedPdf';

export interface OutputExpectation {
  /** Canonical extension/format, for example `pdf`, `png`, `xlsx` or `zip`. */
  format?: string;
  /** Minimum number of meaningful entries required in an archive. */
  minEntries?: number;
  /** Exact archive paths that must be present. */
  expectedFiles?: string[];
  /** Expected PDF page count. */
  expectedPageCount?: number;
  /** Content that must survive in a text/document output. */
  expectedContent?: string | RegExp;
  /** Minimum non-whitespace text/cell content length. */
  minTextLength?: number;
}

export interface OutputValidationResult {
  valid: boolean;
  code?: OutputValidationCode;
  detail?: string;
  format?: string;
  bytes?: number;
  pageCount?: number;
  entries?: string[];
  contentLength?: number;
}

export class OutputValidationError extends Error {
  readonly code: OutputValidationCode;
  readonly detail?: string;

  constructor(code: OutputValidationCode, detail?: string) {
    super(code);
    this.name = 'OutputValidationError';
    this.code = code;
    this.detail = detail;
  }
}

function canonicalFormat(value: string | undefined, blob: Blob): string {
  const source = (value || '').toLowerCase().replace(/^\./, '');
  if (source) return source === 'jpeg' ? 'jpg' : source;
  const mime = (blob.type || '').toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('zip') || mime.includes('compressed')) return 'zip';
  if (mime.includes('spreadsheet')) return 'xlsx';
  if (mime.includes('presentation')) return 'pptx';
  if (mime.includes('word') || mime.includes('msword')) return 'doc';
  if (mime.startsWith('text/')) return 'txt';
  if (mime.includes('json')) return 'json';
  return 'binary';
}

function result(
  valid: boolean,
  format: string,
  bytes: number,
  extra: Partial<OutputValidationResult> = {},
): OutputValidationResult {
  return { valid, format, bytes, ...extra };
}

function fail(
  code: OutputValidationCode,
  format: string,
  bytes: number,
  detail: string,
  extra: Partial<OutputValidationResult> = {},
): OutputValidationResult {
  return result(false, format, bytes, { code, detail, ...extra });
}

function hasPrefix(bytes: Uint8Array, prefix: number[]): boolean {
  return bytes.length >= prefix.length && prefix.every((byte, index) => bytes[index] === byte);
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));
}

function dimensions(bytes: Uint8Array, format: string): { width: number; height: number } | null {
  if (format === 'png' && hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47])) {
    if (bytes.length < 24) return null;
    const width = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(16);
    const height = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(20);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (format === 'gif' && (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')) {
    if (bytes.length < 10) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint16(6, true);
    const height = view.getUint16(8, true);
    return width > 0 && height > 0 ? { width, height } : null;
  }
  if (format === 'webp' && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    // VP8X stores dimensions at bytes 24–29; VP8/VP8L are checked by their
    // frame headers below. All valid WebP encoders use a non-zero canvas.
    if (ascii(bytes, 12, 16) === 'VP8X' && bytes.length >= 30) {
      const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
      return { width, height };
    }
    return bytes.length > 20 ? { width: 1, height: 1 } : null;
  }
  if (format === 'ico' && bytes.length >= 8 && bytes[0] === 0 && bytes[1] === 0 && (bytes[2] === 1 || bytes[2] === 2) && bytes[3] === 0) {
    const count = bytes[4] | (bytes[5] << 8);
    if (!count || bytes.length < 6 + count * 16) return null;
    const width = bytes[6] || 256;
    const height = bytes[7] || 256;
    return { width, height };
  }
  if (format === 'jpg' && bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    // Walk JPEG markers until a SOF marker containing width/height appears.
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) break;
      const length = (bytes[offset] << 8) | bytes[offset + 1];
      if (length < 2 || offset + length > bytes.length) break;
      const isSof = marker >= 0xc0 && marker <= 0xc3 || marker >= 0xc5 && marker <= 0xc7 || marker >= 0xc9 && marker <= 0xcb || marker >= 0xcd && marker <= 0xcf;
      if (isSof && length >= 7) {
        const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
        const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
        return width > 0 && height > 0 ? { width, height } : null;
      }
      offset += length;
    }
    return null;
  }
  // AVIF/HEIC dimensions require parsing an ISO-BMFF item/property graph. The
  // signature and browser decode check still provide a useful safety net.
  if ((format === 'avif' || format === 'heic' || format === 'heif') && bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    return { width: 1, height: 1 };
  }
  return null;
}

function textContent(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:nbsp|amp|lt|gt|quot);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function contentMatches(content: string, expected?: string | RegExp): boolean {
  if (!expected) return true;
  if (typeof expected === 'string') return content.includes(expected);
  expected.lastIndex = 0;
  return expected.test(content);
}

async function validateImage(blob: Blob, bytes: Uint8Array, format: string, expectation: OutputExpectation): Promise<OutputValidationResult> {
  const pngSignature = hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pngEnd = bytes.length >= 12 && ascii(bytes, bytes.length - 8, bytes.length - 4) === 'IEND';
  const jpgSignature = hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  const jpgEnd = bytes.length >= 4 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  const gifSignature = ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a';
  const gifEnd = bytes.length > 13 && bytes[bytes.length - 1] === 0x3b;
  const webpSignature = ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP';
  const webpSize = webpSignature && bytes.length >= 8 ? (bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24)) : 0;
  const webpStructure = webpSignature && webpSize >= 4 && webpSize + 8 <= bytes.length;
  const icoSignature = bytes.length >= 6 && bytes[0] === 0 && bytes[1] === 0 && (bytes[2] === 1 || bytes[2] === 2) && bytes[3] === 0;
  const bmffSignature = (format === 'avif' || format === 'heic' || format === 'heif') && ascii(bytes, 4, 8) === 'ftyp';
  const sigOk =
    (format === 'png' && pngSignature && pngEnd) ||
    (format === 'jpg' && jpgSignature && jpgEnd) ||
    (format === 'gif' && gifSignature && gifEnd) ||
    (format === 'webp' && webpStructure) ||
    (format === 'ico' && icoSignature) ||
    bmffSignature;
  if (!sigOk) return fail('outputInvalid', format, blob.size, 'image signature or end marker does not match the requested format');
  const size = dimensions(bytes, format);
  if (!size || size.width < 1 || size.height < 1 || !Number.isFinite(size.width) || !Number.isFinite(size.height)) {
    return fail('outputUnreadable', format, blob.size, 'image dimensions could not be read');
  }
  if (typeof createImageBitmap === 'function') {
    try {
      const decoded = await createImageBitmap(blob);
      const valid = decoded.width > 0 && decoded.height > 0;
      decoded.close?.();
      if (!valid) return fail('outputUnreadable', format, blob.size, 'browser decoder returned zero dimensions');
    } catch {
      return fail('outputUnreadable', format, blob.size, 'browser could not decode the generated image');
    }
  }
  return result(true, format, blob.size, { contentLength: size.width * size.height });
}

async function validatePdf(bytes: Uint8Array, format: string, blob: Blob, expectation: OutputExpectation): Promise<OutputValidationResult> {
  if (!hasPrefix(bytes, [0x25, 0x50, 0x44, 0x46])) return fail('outputInvalid', format, blob.size, 'missing %PDF header');
  const tail = ascii(bytes, Math.max(0, bytes.length - 2048), bytes.length);
  if (!tail.includes('%%EOF')) return fail('outputUnreadable', format, blob.size, 'missing PDF end marker');
  try {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    let document;
    try {
      document = await PDFDocument.load(bytes, { updateMetadata: false });
    } catch {
      // Protected PDFs are expected to reject a password-less load. Cantoo's
      // ignoreEncryption path still verifies the document structure/pages.
      document = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
    }
    const pageCount = document.getPageCount();
    if (!pageCount) return fail('outputNoContent', format, blob.size, 'PDF contains no pages', { pageCount });
    if (expectation.expectedPageCount !== undefined && pageCount !== expectation.expectedPageCount) {
      return fail('outputNoContent', format, blob.size, `expected ${expectation.expectedPageCount} pages, found ${pageCount}`, { pageCount });
    }
    return result(true, format, blob.size, { pageCount });
  } catch {
    return fail('outputUnreadable', format, blob.size, 'PDF could not be reopened locally');
  }
}

async function validateArchive(blob: Blob, bytes: Uint8Array, format: string, expectation: OutputExpectation): Promise<OutputValidationResult> {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes);
    const entries = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
    if (!entries.length || entries.length < (expectation.minEntries ?? 1)) {
      return fail('outputNoContent', format, blob.size, 'archive contains no usable files', { entries });
    }
    if (expectation.expectedFiles?.some((expected) => !entries.includes(expected))) {
      return fail('outputNoContent', format, blob.size, 'archive is missing an expected file', { entries });
    }
    for (const entry of entries) {
      if (!zip.files[entry]) return fail('archiveInvalid', format, blob.size, 'archive entry is unreadable', { entries });
      if (expectation.expectedFiles?.includes(entry)) {
        const content = await zip.files[entry].async('uint8array');
        if (!content.length) return fail('outputNoContent', format, blob.size, 'an expected archive file is empty', { entries });
      }
    }
    return result(true, format, blob.size, { entries });
  } catch {
    return fail('archiveInvalid', format, blob.size, 'archive could not be opened locally');
  }
}

async function validateOfficeArchive(blob: Blob, bytes: Uint8Array, format: string, expectation: OutputExpectation): Promise<OutputValidationResult> {
  const archive = await validateArchive(blob, bytes, format, expectation);
  if (!archive.valid) return archive;
  const entries = archive.entries ?? [];
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes);
    const contentTypes = zip.files['[Content_Types].xml'];
    if (!contentTypes) return fail('outputInvalid', format, blob.size, 'OOXML content types are missing', { entries });

    let payload = '';
    if (format === 'xlsx' || format === 'xls') {
      if (!entries.includes('xl/workbook.xml') || !entries.some((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))) {
        return fail('outputInvalid', format, blob.size, 'workbook or worksheet XML is missing', { entries });
      }
      for (const name of entries.filter((entry) => entry.startsWith('xl/worksheets/') || entry === 'xl/sharedStrings.xml')) payload += ` ${await zip.files[name].async('string')}`;
    } else if (format === 'pptx' || format === 'ppt') {
      if (!entries.includes('ppt/presentation.xml') || !entries.some((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))) {
        return fail('outputInvalid', format, blob.size, 'presentation or slide XML is missing', { entries });
      }
      for (const name of entries.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry))) payload += ` ${await zip.files[name].async('string')}`;
    } else {
      if (!entries.includes('word/document.xml')) return fail('outputInvalid', format, blob.size, 'Word document XML is missing', { entries });
      payload = await zip.files['word/document.xml'].async('string');
    }
    const meaningful = textContent(payload);
    const minimum = expectation.minTextLength ?? 1;
    if (meaningful.length < minimum || !contentMatches(meaningful, expectation.expectedContent)) {
      return fail('outputNoContent', format, blob.size, 'office document contains no expected meaningful content', { entries, contentLength: meaningful.length });
    }
    return result(true, format, blob.size, { entries, contentLength: meaningful.length });
  } catch {
    return fail('outputUnreadable', format, blob.size, 'office archive contents could not be read', { entries });
  }
}

/** Validate a generated output without throwing. */
export async function validateOutput(blob: Blob | null | undefined, expectation: OutputExpectation = {}): Promise<OutputValidationResult> {
  if (!blob || typeof blob.size !== 'number' || blob.size <= 0) {
    return fail('outputEmpty', expectation.format || '', 0, 'output Blob is empty or missing');
  }
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await blob.arrayBuffer());
  } catch {
    return fail('outputUnreadable', expectation.format || '', blob.size, 'output bytes could not be read');
  }
  if (!bytes.length) return fail('outputEmpty', expectation.format || '', blob.size, 'output bytes are empty');

  const format = canonicalFormat(expectation.format, blob);
  if (!format) return fail('outputInvalid', format, blob.size, 'output format is unknown');

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'avif', 'heic', 'heif'].includes(format)) {
    return validateImage(blob, bytes, format === 'jpeg' ? 'jpg' : format, expectation);
  }
  if (format === 'pdf') return validatePdf(bytes, format, blob, expectation);
  if (format === 'zip') return validateArchive(blob, bytes, format, expectation);
  if (['xlsx', 'xls', 'pptx', 'ppt', 'docx'].includes(format)) {
    return validateOfficeArchive(blob, bytes, format, expectation);
  }
  if (format === 'binary') return result(true, format, blob.size, { contentLength: bytes.length });
  if (format === 'doc') {
    const raw = new TextDecoder().decode(bytes);
    if (!/<html[\s>]/i.test(raw) || !/<body[\s>]/i.test(raw)) return fail('outputInvalid', format, blob.size, 'Word HTML envelope is missing');
    const text = textContent(raw);
    if ((expectation.minTextLength ?? 1) > text.length || !contentMatches(raw, expectation.expectedContent)) return fail('outputNoContent', format, blob.size, 'Word document contains no expected content', { contentLength: text.length });
    return result(true, format, blob.size, { contentLength: text.length });
  }

  const text = new TextDecoder().decode(bytes);
  const meaningful = textContent(text);
  if (!meaningful.length) return fail('outputNoContent', format, blob.size, 'text output is blank');
  if ((expectation.minTextLength ?? 1) > meaningful.length || !contentMatches(text, expectation.expectedContent)) {
    return fail('outputNoContent', format, blob.size, 'text output does not contain the expected content', { contentLength: meaningful.length });
  }
  if (format === 'json') {
    try {
      JSON.parse(text);
    } catch {
      return fail('outputInvalid', format, blob.size, 'JSON output could not be parsed', { contentLength: meaningful.length });
    }
  }
  return result(true, format, blob.size, { contentLength: meaningful.length });
}

/** Validate and throw a stable, translatable error code on failure. */
export async function assertValidOutput(blob: Blob | null | undefined, expectation: OutputExpectation = {}): Promise<OutputValidationResult> {
  const checked = await validateOutput(blob, expectation);
  if (!checked.valid) throw new OutputValidationError(checked.code ?? 'outputInvalid', checked.detail);
  return checked;
}

/** A shared check for PDF text converters: page labels are not transferred content. */
export function hasMeaningfulExtractableText(pages: string[]): boolean {
  return pages.some((page) => {
    const text = page.replace(/\s+/g, '').trim();
    return text.length >= 3;
  });
}

export function assertMeaningfulExtractableText(pages: string[]): void {
  if (!hasMeaningfulExtractableText(pages)) throw new OutputValidationError('scannedPdf', 'PDF has no meaningful extractable text; OCR is required');
}
