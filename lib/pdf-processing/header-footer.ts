/**
 * Header/footer stamping for the PDF Header & Footer tool.
 *
 * Pure placement maths (unit-testable) plus a pdf-lib applicator that draws
 * the lines. Supports `{page}` / `{pages}` placeholders and skips them
 * honestly when the counts are what they are.
 */

import { loadDocument, readBytes } from './index';

export type HeaderFooterAlign = 'left' | 'center' | 'right';

export const HEADER_FOOTER_ALIGNS: HeaderFooterAlign[] = ['left', 'center', 'right'];

export interface HeaderFooterOptions {
  header: string;
  footer: string;
  /** First page number (usually 1). */
  startAt: number;
  /** Skip the header/footer on the first page (cover pages). */
  skipFirst: boolean;
  fontSize: number; // 8..24
  align: HeaderFooterAlign;
}

/** Replace {page} / {pages} placeholders with real numbers. */
export function resolvePlaceholders(template: string, page: number, total: number): string {
  return template
    .replace(/\{page\}/gi, String(page))
    .replace(/\{pages\}/gi, String(total))
    .slice(0, 200);
}

/**
 * Baseline x for a stamped line. PDF user space starts bottom-left; y is
 * computed by the caller (top = pageHeight - margin - fontSize).
 */
export function stampX(
  pageWidth: number,
  textWidth: number,
  align: HeaderFooterAlign,
  margin: number,
): number {
  if (align === 'center') return Math.max(0, (pageWidth - textWidth) / 2);
  if (align === 'right') return Math.max(0, pageWidth - margin - textWidth);
  return margin;
}

/** Draw headers/footers onto every page. Throws PdfError on failure. */
export async function addHeaderFooter(
  file: File,
  options: HeaderFooterOptions,
  password?: string,
): Promise<{ blob: Blob; pages: number }> {
  const { rgb, StandardFonts } = await import('@cantoo/pdf-lib');
  const bytes = await readBytes(file);
  const doc = await loadDocument(bytes, { password });
  const pages = doc.getPages();
  const total = pages.length;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const size = Math.max(8, Math.min(24, Math.round(options.fontSize) || 10));
  const margin = 36;
  const header = options.header.slice(0, 200);
  const footer = options.footer.slice(0, 200);
  const color = rgb(0.35, 0.35, 0.35);

  pages.forEach((page, index) => {
    if (options.skipFirst && index === 0) return;
    const { width, height } = page.getSize();
    const label = options.startAt + index;
    if (header.trim()) {
      const line = resolvePlaceholders(header, label, total);
      const w = font.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: stampX(width, w, options.align, margin),
        y: height - margin - size,
        size,
        font,
        color,
      });
    }
    if (footer.trim()) {
      const line = resolvePlaceholders(footer, label, total);
      const w = font.widthOfTextAtSize(line, size);
      page.drawText(line, {
        x: stampX(width, w, options.align, margin),
        y: margin,
        size,
        font,
        color,
      });
    }
  });

  const out = await doc.save();
  const copy = new Uint8Array(out.length);
  copy.set(out);
  return { blob: new Blob([copy.buffer as ArrayBuffer], { type: 'application/pdf' }), pages: total };
}
