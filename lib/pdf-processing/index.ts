/**
 * Shared client-side PDF processing layer.
 *
 * Everything here runs in the browser. `@cantoo/pdf-lib` (a maintained fork of
 * pdf-lib that additionally supports reading AND writing encrypted documents —
 * upstream pdf-lib cannot decrypt) is imported dynamically so it never lands in
 * the main bundle: only PDF tool pages pay for it.
 *
 * No bytes ever leave the device.
 */

export type PdfProgress = (done: number, total: number) => void;

export class PdfError extends Error {
  readonly key: string;
  constructor(key: string) {
    super(key);
    this.key = key;
    this.name = 'PdfError';
  }
}

type PdfLib = typeof import('@cantoo/pdf-lib');

let libPromise: Promise<PdfLib> | null = null;

/** Dynamically load pdf-lib once per session. */
export function loadPdfLib(): Promise<PdfLib> {
  if (!libPromise) libPromise = import('@cantoo/pdf-lib');
  return libPromise;
}

/** Verify the `%PDF` magic bytes at offset 0 before touching pdf-lib. */
export async function assertPdfFile(file: File): Promise<void> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (head.length < 4) throw new PdfError('invalidPdf');
  if (
    head[0] !== 0x25 || // %
    head[1] !== 0x50 || // P
    head[2] !== 0x44 || // D
    head[3] !== 0x46 // F
  ) {
    throw new PdfError('invalidPdf');
  }
}

export async function readBytes(file: File): Promise<Uint8Array> {
  await assertPdfFile(file);
  return new Uint8Array(await file.arrayBuffer());
}

interface LoadOptions {
  password?: string;
  /** Set when the caller intends to copy pages out of the document. */
  ignoreEncryption?: boolean;
}

/** Load a document, mapping pdf-lib failures onto translatable error keys. */
export async function loadDocument(bytes: Uint8Array, options: LoadOptions = {}) {
  const { PDFDocument, EncryptedPDFError } = await loadPdfLib();
  try {
    return await PDFDocument.load(bytes, {
      password: options.password,
      ignoreEncryption: options.ignoreEncryption,
      updateMetadata: false,
    });
  } catch (error) {
    if (error instanceof EncryptedPDFError) throw new PdfError('pdfEncrypted');
    const message = error instanceof Error ? error.message : '';
    if (/password/i.test(message)) throw new PdfError('pdfWrongPassword');
    if (/memory|allocation/i.test(message)) throw new PdfError('pdfTooLarge');
    throw new PdfError('invalidPdf');
  }
}

/** Read a document straight from a File. */
export async function openFile(file: File, password?: string) {
  const bytes = await readBytes(file);
  const doc = await loadDocument(bytes, { password });
  return doc;
}

export interface PdfFileInfo {
  name: string;
  size: number;
  pageCount: number;
  encrypted: boolean;
}

/** Cheap metadata probe used by the page counter and info cards. */
export async function inspect(file: File): Promise<PdfFileInfo> {
  const bytes = await readBytes(file);
  try {
    const doc = await loadDocument(bytes);
    return { name: file.name, size: file.size, pageCount: doc.getPageCount(), encrypted: false };
  } catch (error) {
    if (error instanceof PdfError && error.key === 'pdfEncrypted') {
      return { name: file.name, size: file.size, pageCount: 0, encrypted: true };
    }
    throw error;
  }
}

function toBlob(bytes: Uint8Array): Blob {
  // Copy into a fresh ArrayBuffer so the source view can be garbage collected.
  return new Blob([bytes.slice().buffer], { type: 'application/pdf' });
}

/** Merge several PDFs into one, preserving the given file order. */
export async function mergePdfs(files: File[], onProgress?: PdfProgress): Promise<Blob> {
  if (files.length < 2) throw new PdfError('pdfNeedTwo');
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();

  const counts: number[] = [];
  const docs = [];
  for (const file of files) {
    const doc = await openFile(file);
    counts.push(doc.getPageCount());
    docs.push(doc);
  }
  const total = counts.reduce((a, b) => a + b, 0);

  let done = 0;
  for (const doc of docs) {
    const indices = doc.getPageIndices();
    const pages = await out.copyPages(doc, indices);
    for (const page of pages) {
      out.addPage(page);
      done += 1;
      onProgress?.(done, total);
    }
  }
  const bytes = await out.save();
  docs.length = 0;
  return toBlob(bytes);
}

/** Build a new PDF from a subset (and ordering) of another document's pages. */
export async function pagesToPdf(file: File, pageIndices: number[], password?: string): Promise<Blob> {
  if (!pageIndices.length) throw new PdfError('pdfNoPages');
  const { PDFDocument } = await loadPdfLib();
  const src = await openFile(file, password);
  const count = src.getPageCount();
  for (const index of pageIndices) {
    if (index < 0 || index >= count) throw new PdfError('pdfRangeOutOfBounds');
  }
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, pageIndices);
  copied.forEach((page) => out.addPage(page));
  return toBlob(await out.save());
}

export interface SplitPart {
  label: string;
  pageIndices: number[];
}

/** Produce one Blob per split part. */
export async function splitPdf(
  file: File,
  parts: SplitPart[],
  onProgress?: PdfProgress,
): Promise<{ label: string; blob: Blob }[]> {
  const { PDFDocument } = await loadPdfLib();
  const src = await openFile(file);
  const results: { label: string; blob: Blob }[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, part.pageIndices);
    copied.forEach((page) => out.addPage(page));
    results.push({ label: part.label, blob: toBlob(await out.save()) });
    onProgress?.(i + 1, parts.length);
  }
  return results;
}

/** Apply per-page rotations (absolute degrees: 0/90/180/270). */
export async function rotatePdf(file: File, rotations: number[]): Promise<Blob> {
  const { degrees } = await loadPdfLib();
  const doc = await openFile(file);
  doc.getPages().forEach((page, i) => {
    const angle = ((rotations[i] ?? 0) % 360 + 360) % 360;
    page.setRotation(degrees(angle));
  });
  return toBlob(await doc.save());
}

export interface ProtectOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopying?: boolean;
  allowModifying?: boolean;
}

/** Encrypt a PDF with a user (open) password and optional permissions. */
export async function protectPdf(file: File, options: ProtectOptions): Promise<Blob> {
  if (options.userPassword.length < 4) throw new PdfError('pdfPasswordShort');
  const doc = await openFile(file);
  doc.encrypt({
    userPassword: options.userPassword,
    ownerPassword: options.ownerPassword || options.userPassword,
    permissions: {
      printing: options.allowPrinting === false ? undefined : 'highResolution',
      copying: options.allowCopying !== false,
      modifying: options.allowModifying === true,
      annotating: options.allowModifying === true,
    },
  });
  return toBlob(await doc.save());
}

/** Remove encryption from a document the user can supply the password for. */
export async function unlockPdf(file: File, password: string): Promise<Blob> {
  const bytes = await readBytes(file);
  const { PDFDocument } = await loadPdfLib();

  // Detect whether the document is actually encrypted at all.
  let alreadyOpen = false;
  try {
    await PDFDocument.load(bytes, { updateMetadata: false });
    alreadyOpen = true;
  } catch {
    alreadyOpen = false;
  }
  if (alreadyOpen) throw new PdfError('pdfNotEncrypted');

  let src;
  try {
    src = await PDFDocument.load(bytes, { password, updateMetadata: false });
  } catch {
    throw new PdfError('pdfWrongPassword');
  }
  // Copy pages into a clean document so no encryption dictionary survives.
  const out = await PDFDocument.create();
  const copied = await out.copyPages(src, src.getPageIndices());
  copied.forEach((page) => out.addPage(page));
  return toBlob(await out.save());
}

/** Light/medium compression: re-serialize with object streams. */
export async function recompressPdf(file: File, useObjectStreams: boolean): Promise<Blob> {
  const doc = await openFile(file);
  const bytes = await doc.save({ useObjectStreams, addDefaultPage: false });
  return toBlob(bytes);
}

/** Rebuild a PDF from already-rendered JPEG page images (maximum compression). */
export async function pdfFromJpegPages(
  pages: { data: Uint8Array; width: number; height: number }[],
): Promise<Blob> {
  const { PDFDocument } = await loadPdfLib();
  const out = await PDFDocument.create();
  for (const page of pages) {
    const image = await out.embedJpg(page.data);
    const p = out.addPage([page.width, page.height]);
    p.drawImage(image, { x: 0, y: 0, width: page.width, height: page.height });
  }
  return toBlob(await out.save());
}

export interface WatermarkOptions {
  text: string;
  fontSize?: number;
  opacity?: number; // 0..1
  position?: 'diagonal' | 'center' | 'top' | 'bottom';
  colorHex?: string;
}

/** Add custom text watermark to every page of a PDF document. */
export async function watermarkPdf(
  file: File,
  options: WatermarkOptions,
  onProgress?: PdfProgress,
): Promise<Blob> {
  const { text, fontSize = 48, opacity = 0.3, position = 'diagonal', colorHex = '#888888' } = options;
  if (!text.trim()) throw new PdfError('emptyFile');

  const { PDFDocument, StandardFonts, rgb, degrees } = await loadPdfLib();
  const doc = await openFile(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();
  const total = pages.length;

  // Parse hex color
  const hex = colorHex.replace('#', '');
  const r = parseInt(hex.slice(0, 2) || '88', 16) / 255;
  const g = parseInt(hex.slice(2, 4) || '88', 16) / 255;
  const b = parseInt(hex.slice(4, 6) || '88', 16) / 255;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    let x = (width - textWidth) / 2;
    let y = (height - textHeight) / 2;
    let rotate = degrees(0);

    if (position === 'diagonal') {
      const angle = Math.atan2(height, width) * (180 / Math.PI);
      rotate = degrees(angle);
      x = (width - textWidth * Math.cos(angle * Math.PI / 180)) / 2;
      y = (height - textWidth * Math.sin(angle * Math.PI / 180)) / 2;
    } else if (position === 'top') {
      y = height - textHeight - 40;
    } else if (position === 'bottom') {
      y = 40;
    }

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(r, g, b),
      opacity,
      rotate,
    });

    onProgress?.(i + 1, total);
  }

  const bytes = await doc.save();
  return toBlob(bytes);
}

export interface PageNumberOptions {
  format?: 'page-of-total' | 'page-only' | 'page-prefix';
  position?: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left';
  startNumber?: number;
  fontSize?: number;
  colorHex?: string;
}

/** Add page numbers to all pages of a PDF document. */
export async function addPageNumbersToPdf(
  file: File,
  options: PageNumberOptions = {},
  onProgress?: PdfProgress,
): Promise<Blob> {
  const {
    format = 'page-of-total',
    position = 'bottom-center',
    startNumber = 1,
    fontSize = 11,
    colorHex = '#555555',
  } = options;

  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const doc = await openFile(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  const hex = colorHex.replace('#', '');
  const r = parseInt(hex.slice(0, 2) || '55', 16) / 255;
  const g = parseInt(hex.slice(2, 4) || '55', 16) / 255;
  const b = parseInt(hex.slice(4, 6) || '55', 16) / 255;

  const margin = 28;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const { width, height } = page.getSize();
    const currentNum = startNumber + i;

    let numStr = `${currentNum}`;
    if (format === 'page-of-total') {
      numStr = `Page ${currentNum} of ${total}`;
    } else if (format === 'page-prefix') {
      numStr = `Page ${currentNum}`;
    }

    const textWidth = font.widthOfTextAtSize(numStr, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    let x = (width - textWidth) / 2;
    let y = margin;

    if (position.includes('left')) {
      x = margin;
    } else if (position.includes('right')) {
      x = width - textWidth - margin;
    } else {
      x = (width - textWidth) / 2;
    }

    if (position.startsWith('top')) {
      y = height - textHeight - margin;
    } else {
      y = margin;
    }

    page.drawText(numStr, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(r, g, b),
    });

    onProgress?.(i + 1, total);
  }

  const bytes = await doc.save();
  return toBlob(bytes);
}

/** Extract text content from a text-based PDF using pdf.js. */
export async function extractTextFromPdf(
  file: File,
  onProgress?: PdfProgress,
): Promise<string> {
  const { loadPdfJs } = await import('./render');
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();

  const doc = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const total = doc.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
      .filter(Boolean);

    const text = strings.join(' ').replace(/\s+/g, ' ').trim();
    pageTexts.push(`--- Page ${i} ---\n\n${text || '[No extractable text on this page]'}`);
    page.cleanup();
    onProgress?.(i, total);
  }

  await doc.destroy();
  return pageTexts.join('\n\n');
}
