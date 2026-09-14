/**
 * Watermark placement maths for the PDF Watermark tool.
 *
 * Pure functions (no pdf-lib) so the exact x/y of every stamp can be tested:
 * a centred diagonal mark, a header/footer band, or a tiled grid.
 */

export type WatermarkLayout = 'diagonal' | 'center' | 'top' | 'bottom' | 'tile';

export const WATERMARK_LAYOUTS: WatermarkLayout[] = ['diagonal', 'center', 'top', 'bottom', 'tile'];

export interface WatermarkPlacement {
  x: number;
  y: number;
  /** Rotation in degrees (counter-clockwise, PDF convention). */
  rotate: number;
  opacity: number;
}

export interface WatermarkInput {
  pageWidth: number;
  pageHeight: number;
  /** Measured width of the watermark text in points. */
  textWidth: number;
  /** Font size in points. */
  fontSize: number;
  layout: WatermarkLayout;
  /** 0–100. */
  opacity: number;
}

/** Distance between tiles, in points. */
const TILE_X_GAP = 140;
const TILE_Y_GAP = 110;

/**
 * Positions/rotations for every stamp on one page. The caller draws them with
 * `page.drawText(text, { x, y, size, rotate: degrees(rotate), opacity })`.
 */
export function watermarkPlacements({
  pageWidth,
  pageHeight,
  textWidth,
  fontSize,
  layout,
  opacity,
}: WatermarkInput): WatermarkPlacement[] {
  const alpha = Math.min(1, Math.max(0.02, opacity / 100));
  const margin = Math.max(18, fontSize);

  if (layout === 'tile') {
    const out: WatermarkPlacement[] = [];
    const stepX = Math.max(textWidth + TILE_X_GAP, 60);
    const stepY = Math.max(fontSize * 4, TILE_Y_GAP);
    for (let y = margin; y <= pageHeight - margin * 0.5; y += stepY) {
      // Offset every other row so the grid reads as a pattern, not columns.
      const rowIndex = Math.round((y - margin) / stepY);
      const offset = rowIndex % 2 ? stepX / 2 : 0;
      // A tile may bleed a little past the edge (the pattern is meant to run
      // off the page) but never so much that most of a stamp is invisible.
      for (let x = margin + offset; x + textWidth * 0.5 <= pageWidth; x += stepX) {
        out.push({ x, y, rotate: 0, opacity: alpha });
      }
    }
    return out.length ? out : [{ x: margin, y: margin, rotate: 0, opacity: alpha }];
  }

  const rotate = layout === 'diagonal' ? 45 : 0;
  // A rotated label is centred on itself; an unrotated one is placed by its
  // own baseline, so the vertical maths differs between the two.
  let y: number;
  if (layout === 'top') y = pageHeight - margin - fontSize;
  else if (layout === 'bottom') y = margin;
  else y = (pageHeight - fontSize) / 2;

  const x = pageWidth / 2 - (rotate ? (textWidth / 2) * Math.cos((rotate * Math.PI) / 180) : textWidth / 2);

  return [{ x: Math.max(0, x), y: Math.max(0, y), rotate, opacity: alpha }];
}
