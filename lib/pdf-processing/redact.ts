'use client';

/**
 * PDF Redaction — real permanent removal, not just overlay.
 * 
 * Honest implementation approach:
 * 
 * True redaction in PDF spec requires removing content from content streams.
 * Client-side, we achieve permanent removal by rasterizing pages to images,
 * applying black rectangles on the raster, then creating a new PDF from those
 * images. This ensures original text under redaction CANNOT be recovered by
 * selecting, copying, or editing PDF content streams.
 * 
 * Trade-off: Redacted pages become image-based (text not selectable in
 * redacted areas, and for simplicity, entire redacted pages become images).
 * This is honest and permanent — unlike fake overlay that just draws black
 * boxes over selectable text.
 * 
 * Alternative for non-raster approach (future): parse content streams and
 * remove text operators. But raster approach is reliable client-side.
 * 
 * We also provide a second mode: overlay-only redaction with warning that
 * it's NOT permanent and text may be recoverable. User chooses.
 */

import { readBytes, loadDocument } from './index';

export interface RedactionRect {
  pageIndex: number;
  x: number; // PDF points, bottom-left origin
  y: number;
  width: number;
  height: number;
}

export interface RedactOptions {
  /** If true, rasterize redacted pages to ensure permanent removal (recommended) */
  permanent?: boolean;
  /** Fill color for redaction (default black) */
  color?: { r: number; g: number; b: number };
}

/**
 * Render PDF page to canvas via pdf.js, apply redactions, then embed as image in new PDF
 * This ensures permanent removal
 */
export async function redactPdfPermanent(
  file: File,
  redactions: RedactionRect[],
  options: RedactOptions = {},
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const { PDFDocument } = await import('@cantoo/pdf-lib');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const srcDoc = await loadDocument(bytes);
  const pageCount = srcDoc.getPageCount();

  // Group redactions by page
  const redactionsByPage = new Map<number, RedactionRect[]>();
  for (const r of redactions) {
    if (r.pageIndex < 0 || r.pageIndex >= pageCount) continue;
    const list = redactionsByPage.get(r.pageIndex) || [];
    list.push(r);
    redactionsByPage.set(r.pageIndex, list);
  }

  // Load pdf.js for rendering
  const pdfjsLib = await import('pdfjs-dist');
  // Set worker
  if (typeof window !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  }

  const loadingTask = pdfjsLib.getDocument({ data: bytes.slice() });
  const pdf = await loadingTask.promise;

  const outDoc = await PDFDocument.create();

  for (let i = 0; i < pageCount; i++) {
    onProgress?.(i, pageCount);
    const page = srcDoc.getPage(i);
    const { width, height } = page.getSize();
    const pageRedactions = redactionsByPage.get(i) || [];

    if (!pageRedactions.length) {
      // No redaction on this page — copy as-is (preserve text selectability)
      const [copied] = await outDoc.copyPages(srcDoc, [i]);
      outDoc.addPage(copied);
      continue;
    }

    // Render page to canvas
    const pdfPage = await pdf.getPage(i + 1);
    const viewport = pdfPage.getViewport({ scale: 2 }); // 2x for quality

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    await pdfPage.render({ canvasContext: ctx as any, viewport }).promise;

    // Apply redactions: convert PDF coordinates to canvas coordinates
    // PDF origin bottom-left, canvas origin top-left
    const scaleX = viewport.width / width;
    const scaleY = viewport.height / height;

    ctx.fillStyle = `rgb(${options.color?.r ?? 0}, ${options.color?.g ?? 0}, ${options.color?.b ?? 0})`;

    for (const r of pageRedactions) {
      // Convert PDF rect to canvas rect
      const canvasX = r.x * scaleX;
      const canvasY = viewport.height - (r.y + r.height) * scaleY; // flip Y
      const canvasW = r.width * scaleX;
      const canvasH = r.height * scaleY;
      ctx.fillRect(canvasX, canvasY, canvasW, canvasH);
    }

    // Convert canvas to JPEG and embed in new PDF
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    if (!blob) throw new Error('Failed to render page');
    const imgBytes = new Uint8Array(await blob.arrayBuffer());
    const jpgImage = await outDoc.embedJpg(imgBytes);
    const newPage = outDoc.addPage([width, height]);
    newPage.drawImage(jpgImage, { x: 0, y: 0, width, height });
  }

  onProgress?.(pageCount, pageCount);
  const pdfBytes = await outDoc.save();
  return new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
}

/**
 * Overlay redaction (NOT permanent) — just draws black boxes
 * Included to show difference, but we warn user it's not secure
 */
export async function redactPdfOverlay(
  file: File,
  redactions: RedactionRect[],
  options: RedactOptions = {},
): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await loadDocument(bytes);
  const { rgb } = await import('@cantoo/pdf-lib');

  const color = options.color || { r: 0, g: 0, b: 0 };

  // Group by page
  const byPage = new Map<number, RedactionRect[]>();
  for (const r of redactions) {
    if (r.pageIndex < 0 || r.pageIndex >= doc.getPageCount()) continue;
    const list = byPage.get(r.pageIndex) || [];
    list.push(r);
    byPage.set(r.pageIndex, list);
  }

  for (const [pageIndex, rects] of byPage.entries()) {
    const page = doc.getPage(pageIndex);
    for (const rect of rects) {
      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        color: rgb(color.r / 255, color.g / 255, color.b / 255),
      });
    }
  }

  const pdfBytes = await doc.save();
  return new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
}
