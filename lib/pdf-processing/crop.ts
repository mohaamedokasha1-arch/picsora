/**
 * PDF cropping — shrink every page's CropBox by margin percentages.
 *
 * Pure box maths (unit-testable) plus a thin pdf-lib applicator. Cropping a
 * PDF never deletes content, it only changes the visible area — the UI says
 * so, because "crop" misleads users into thinking data is removed.
 */

import { loadDocument, readBytes } from './index';

export interface CropMargins {
  top: number; // 0..45 percent
  right: number;
  bottom: number;
  left: number;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Clamp a margin into the safe 0–45% range. */
export function clampMargin(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(45, value));
}

/**
 * Compute the new CropBox for a page of `pageWidth`×`pageHeight` points.
 * PDF user space starts at the bottom-left, so the bottom margin moves the
 * box origin up.
 */
export function cropBoxFor(
  pageWidth: number,
  pageHeight: number,
  margins: CropMargins,
): CropBox {
  const top = clampMargin(margins.top);
  const right = clampMargin(margins.right);
  const bottom = clampMargin(margins.bottom);
  const left = clampMargin(margins.left);
  const x = (pageWidth * left) / 100;
  const width = Math.max(1, pageWidth - (pageWidth * (left + right)) / 100);
  const height = Math.max(1, pageHeight - (pageHeight * (top + bottom)) / 100);
  // y is measured from the bottom edge.
  const y = (pageHeight * bottom) / 100;
  return { x, y, width, height };
}

/** Apply crop margins to every page of a PDF. Throws PdfError on failure. */
export async function cropPdf(
  file: File,
  margins: CropMargins,
  password?: string,
): Promise<{ blob: Blob; pages: number }> {
  const bytes = await readBytes(file);
  const doc = await loadDocument(bytes, { password });
  const pages = doc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();
    const box = cropBoxFor(width, height, margins);
    page.setCropBox(box.x, box.y, box.width, box.height);
    // Keep the other boxes consistent so viewers don't show stale areas.
    page.setTrimBox(box.x, box.y, box.width, box.height);
  }
  const out = await doc.save();
  const copy = new Uint8Array(out.length);
  copy.set(out);
  return { blob: new Blob([copy.buffer as ArrayBuffer], { type: 'application/pdf' }), pages: pages.length };
}
