/**
 * Pure crop-frame geometry for the cropper tool — no React, no DOM.
 * Kept separate so the ratio behaviour can be unit-tested directly
 * (see scripts/tool-tests/run-tests.ts).
 */

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const RATIOS: Record<string, number | null> = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '3:2': 3 / 2,
  '9:16': 9 / 16,
};

/**
 * Snap a crop box to an aspect ratio:
 * - covers the CURRENT selection (grows the dominant dimension so the user's
 *   framing intent is kept, centred where they had it),
 * - then shrinks to the largest ratio-correct box that fits inside the image.
 */
export function ratioBoxFor(imgW: number, imgH: number, r: number, current: Box): Box {
  const cx = current.w > 0 ? current.x + current.w / 2 : imgW / 2;
  const cy = current.h > 0 ? current.y + current.h / 2 : imgH / 2;
  let w = Math.max(current.w, current.h * r);
  let h = w / r;
  if (w > imgW) {
    w = imgW;
    h = w / r;
  }
  if (h > imgH) {
    h = imgH;
    w = h * r;
  }
  const x = Math.max(0, Math.min(imgW - w, cx - w / 2));
  const y = Math.max(0, Math.min(imgH - h, cy - h / 2));
  return { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
}

/**
 * Ratio-locked corner resize. The dominant dragged dimension drives the size,
 * the other follows the ratio; the pair is then fitted into the space
 * available FROM THE FIXED ANCHOR, so hitting an image edge shrinks the frame
 * proportionally instead of silently breaking the locked ratio.
 *
 * @param cx 'e' when dragging an east corner (anchor is the west edge), 'w' otherwise
 * @param cy 's' when dragging a south corner (anchor is the north edge), 'n' otherwise
 */
export function ratioResizeBox(
  imgW: number,
  imgH: number,
  r: number,
  anchorX: number,
  anchorY: number,
  cx: 'e' | 'w',
  cy: 's' | 'n',
  dragW: number,
  dragH: number,
  min: number,
): Box {
  const availW = cx === 'e' ? imgW - anchorX : anchorX;
  const availH = cy === 's' ? imgH - anchorY : anchorY;
  let w = dragW;
  let h = dragH;
  if (w / r >= h) h = w / r;
  else w = h * r;
  w = Math.min(w, availW, availH * r);
  h = w / r;
  const minW = Math.max(min, min * r);
  if (w < minW) {
    w = Math.min(minW, availW, availH * r);
    h = w / r;
  }
  return {
    x: cx === 'e' ? anchorX : anchorX - w,
    y: cy === 's' ? anchorY : anchorY - h,
    w,
    h,
  };
}
