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
