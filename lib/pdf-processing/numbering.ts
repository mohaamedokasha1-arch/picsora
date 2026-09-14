/**
 * Page numbering maths for the PDF Page Numberer.
 *
 * Pure functions (no pdf-lib) so the label text and the exact baseline
 * position on the page can be unit-tested without a browser.
 */

export type PageNumberPosition =
  | 'bottom-center'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-center'
  | 'top-right'
  | 'top-left';

export type PageNumberFormat = 'plain' | 'page-n' | 'n-of-total' | 'page-n-of-total';

export const PAGE_NUMBER_POSITIONS: PageNumberPosition[] = [
  'bottom-center',
  'bottom-right',
  'bottom-left',
  'top-center',
  'top-right',
  'top-left',
];

export const PAGE_NUMBER_FORMATS: PageNumberFormat[] = ['plain', 'page-n', 'n-of-total', 'page-n-of-total'];

/** Label drawn on a page: 7 → "7", "Page 7", "7 / 12", "Page 7 of 12". */
export function pageNumberLabel(
  format: PageNumberFormat,
  pageNumber: number,
  totalPages: number,
): string {
  switch (format) {
    case 'page-n':
      return `Page ${pageNumber}`;
    case 'n-of-total':
      return `${pageNumber} / ${totalPages}`;
    case 'page-n-of-total':
      return `Page ${pageNumber} of ${totalPages}`;
    default:
      return String(pageNumber);
  }
}

export interface PlacementInput {
  pageWidth: number;
  pageHeight: number;
  /** Measured width of the label in points (font.widthOfTextAtSize). */
  textWidth: number;
  /** Text height in points — used as the baseline offset for top positions. */
  textHeight: number;
  /** Distance from the page edge in points. */
  margin: number;
  position: PageNumberPosition;
}

/**
 * Baseline position for a page number. PDF user space starts at the
 * bottom-left corner, so "bottom" positions use the margin directly and "top"
 * positions subtract the text height from the page height.
 */
export function pageNumberPlacement({
  pageWidth,
  pageHeight,
  textWidth,
  textHeight,
  margin,
  position,
}: PlacementInput): { x: number; y: number } {
  const safeMargin = Math.max(0, margin);
  const top = position.startsWith('top');
  const y = top ? pageHeight - safeMargin - textHeight : safeMargin;
  let x: number;
  if (position.endsWith('left')) x = safeMargin;
  else if (position.endsWith('right')) x = pageWidth - safeMargin - textWidth;
  else x = (pageWidth - textWidth) / 2;
  return { x: Math.max(0, x), y: Math.max(0, y) };
}

/** Clamp a user-supplied margin so it can never swallow a small page. */
export function clampMargin(margin: number, pageHeight: number): number {
  const max = Math.max(6, pageHeight / 3);
  return Math.min(Math.max(6, margin), max);
}
