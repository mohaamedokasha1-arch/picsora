/**
 * Pixel-level effects shared by the Image Blur, Image Pixelate, Brightness &
 * Contrast, Image Filters and Rounded Corners tools.
 *
 * Everything here is a pure function over an RGBA buffer (`Uint8ClampedArray`)
 * so the exact same code powers the on-screen live preview and the final
 * download — what the user sees is literally what they get. No libraries, no
 * uploads: a handful of loops over `ImageData`.
 */

/** A rectangle in normalised image coordinates (0–1), used for redaction areas. */
export interface NormRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle in pixels. */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type FilterPreset = 'grayscale' | 'sepia' | 'invert' | 'sharpen';

export const FILTER_PRESETS: FilterPreset[] = ['grayscale', 'sepia', 'invert', 'sharpen'];

/** Clamp a pixel rectangle to the buffer and drop empty results. */
export function clampRect(rect: PixelRect, width: number, height: number): PixelRect | null {
  const x = Math.max(0, Math.min(width, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height, Math.round(rect.y)));
  const w = Math.max(0, Math.min(width - x, Math.round(rect.w)));
  const h = Math.max(0, Math.min(height - y, Math.round(rect.h)));
  if (w < 1 || h < 1) return null;
  return { x, y, w, h };
}

/** Turn normalised selection rectangles into clamped pixel rectangles. */
export function toPixelRects(rects: NormRect[], width: number, height: number): PixelRect[] {
  const out: PixelRect[] = [];
  for (const r of rects) {
    const px = clampRect(
      { x: r.x * width, y: r.y * height, w: r.w * width, h: r.h * height },
      width,
      height,
    );
    if (px) out.push(px);
  }
  return out;
}

/* ------------------------------------------------------------------- blur */

/**
 * Three stacked box blurs ≈ a Gaussian blur, at a tiny fraction of the cost.
 * The pass reads from `src` and writes into `dst`, clamping at the region
 * border so edges do not darken.
 */
function boxPass(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
  horizontal: boolean,
): void {
  const span = radius * 2 + 1;
  const outer = horizontal ? h : w;
  const inner = horizontal ? w : h;
  const stride = horizontal ? 4 : w * 4;
  const lineStep = horizontal ? w * 4 : 4;

  for (let o = 0; o < outer; o += 1) {
    const base = o * lineStep;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    // Prime the running sum with the first `radius + 1` samples (edge clamped).
    for (let i = -radius; i <= radius; i += 1) {
      const idx = base + Math.max(0, Math.min(inner - 1, i)) * stride;
      r += src[idx];
      g += src[idx + 1];
      b += src[idx + 2];
      a += src[idx + 3];
    }
    for (let i = 0; i < inner; i += 1) {
      const idx = base + i * stride;
      dst[idx] = r / span;
      dst[idx + 1] = g / span;
      dst[idx + 2] = b / span;
      dst[idx + 3] = a / span;
      const outIdx = base + Math.max(0, i - radius) * stride;
      const inIdx = base + Math.min(inner - 1, i + radius + 1) * stride;
      r += src[inIdx] - src[outIdx];
      g += src[inIdx + 1] - src[outIdx + 1];
      b += src[inIdx + 2] - src[outIdx + 2];
      a += src[inIdx + 3] - src[outIdx + 3];
    }
  }
}

/**
 * Blur one rectangle of an RGBA buffer in place.
 * `radius` is in pixels of the target buffer.
 */
export function blurRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rect: PixelRect | null,
  radius: number,
  passes = 3,
): void {
  const area = rect ?? { x: 0, y: 0, w: width, h: height };
  const r = Math.max(0, Math.round(radius));
  if (r < 1) return;
  const { x, y, w, h } = area;
  if (w < 1 || h < 1) return;

  // Work on a copy of the region so neighbouring areas never bleed in.
  const region = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row += 1) {
    const from = ((y + row) * width + x) * 4;
    region.set(data.subarray(from, from + w * 4), row * w * 4);
  }

  let a = region;
  let b = new Uint8ClampedArray(region.length);
  for (let pass = 0; pass < passes; pass += 1) {
    boxPass(a, b, w, h, r, true);
    boxPass(b, a, w, h, r, false);
  }

  for (let row = 0; row < h; row += 1) {
    const to = ((y + row) * width + x) * 4;
    data.set(a.subarray(row * w * 4, (row + 1) * w * 4), to);
  }
}

/**
 * Blur strength is stored as "pixels at a 1000px-wide image" so the live
 * preview (a smaller canvas) and the full-resolution export stay identical.
 */
export function blurRadiusFor(amount: number, longEdge: number): number {
  return Math.max(1, (amount * longEdge) / 1000);
}

/* --------------------------------------------------------------- pixelate */

/** Average each block of a rectangle and paint it back as one flat colour. */
export function pixelateRect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  rect: PixelRect | null,
  blockSize: number,
): void {
  const area = rect ?? { x: 0, y: 0, w: width, h: height };
  const block = Math.max(2, Math.round(blockSize));
  const { x, y, w, h } = area;

  for (let by = y; by < y + h; by += block) {
    const maxY = Math.min(y + h, by + block);
    for (let bx = x; bx < x + w; bx += block) {
      const maxX = Math.min(x + w, bx + block);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;
      for (let py = by; py < maxY; py += 1) {
        let idx = (py * width + bx) * 4;
        for (let px = bx; px < maxX; px += 1) {
          r += data[idx];
          g += data[idx + 1];
          b += data[idx + 2];
          a += data[idx + 3];
          count += 1;
          idx += 4;
        }
      }
      if (!count) continue;
      const rAvg = r / count;
      const gAvg = g / count;
      const bAvg = b / count;
      const aAvg = a / count;
      for (let py = by; py < maxY; py += 1) {
        let idx = (py * width + bx) * 4;
        for (let px = bx; px < maxX; px += 1) {
          data[idx] = rAvg;
          data[idx + 1] = gAvg;
          data[idx + 2] = bAvg;
          data[idx + 3] = aAvg;
          idx += 4;
        }
      }
    }
  }
}

/**
 * Pixelate block size is also defined against a 1000px image, so the preview
 * matches the export on any resolution.
 */
export function pixelBlockFor(size: number, longEdge: number): number {
  return Math.max(2, Math.round((size * longEdge) / 1000));
}

/* --------------------------------------------------- brightness / contrast */

/**
 * `brightness` and `contrast` are both -100…100 (0 = untouched).
 * Formula: v' = (v - 128) · contrastFactor + 128 + brightnessOffset.
 */
export function brightnessContrastFactor(contrast: number): number {
  const c = Math.max(-100, Math.min(100, contrast));
  return c >= 0 ? 1 + (c / 100) * 1.5 : 1 + c / 100;
}

export function applyBrightnessContrast(
  data: Uint8ClampedArray,
  brightness: number,
  contrast: number,
): void {
  const offset = (Math.max(-100, Math.min(100, brightness)) / 100) * 128;
  const factor = brightnessContrastFactor(contrast);
  if (offset === 0 && factor === 1) return;
  // 256-entry lookup table: one pass over the pixels, no per-pixel maths.
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) {
    lut[i] = (i - 128) * factor + 128 + offset;
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }
}

/* ---------------------------------------------------------------- filters */

const SEPIA_MATRIX = [
  0.393, 0.769, 0.189,
  0.349, 0.686, 0.168,
  0.272, 0.534, 0.131,
];

/**
 * Apply a colour filter preset in place.
 * `strength` (0–100) blends the result with the original, so "50% sepia"
 * behaves like a slider instead of an on/off switch.
 */
export function applyColorFilter(
  data: Uint8ClampedArray,
  preset: Exclude<FilterPreset, 'sharpen'>,
  strength = 100,
): void {
  const mix = Math.max(0, Math.min(100, strength)) / 100;
  if (mix === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    let nr = r;
    let ng = g;
    let nb = b;
    if (preset === 'grayscale') {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      nr = lum;
      ng = lum;
      nb = lum;
    } else if (preset === 'sepia') {
      nr = SEPIA_MATRIX[0] * r + SEPIA_MATRIX[1] * g + SEPIA_MATRIX[2] * b;
      ng = SEPIA_MATRIX[3] * r + SEPIA_MATRIX[4] * g + SEPIA_MATRIX[5] * b;
      nb = SEPIA_MATRIX[6] * r + SEPIA_MATRIX[7] * g + SEPIA_MATRIX[8] * b;
    } else {
      nr = 255 - r;
      ng = 255 - g;
      nb = 255 - b;
    }
    data[i] = r + (nr - r) * mix;
    data[i + 1] = g + (ng - g) * mix;
    data[i + 2] = b + (nb - b) * mix;
  }
}

/**
 * Unsharp-mask style sharpen: a 3×3 kernel that boosts the centre pixel and
 * subtracts its four neighbours. `strength` scales how far the result may
 * travel from the source, so the slider never produces harsh halos.
 */
export function sharpenImage(data: Uint8ClampedArray, width: number, height: number, strength = 100): void {
  const amount = Math.max(0, Math.min(100, strength)) / 100;
  if (amount === 0 || width < 3 || height < 3) return;
  const src = new Uint8ClampedArray(data);
  const at = (x: number, y: number, c: number) => {
    const cx = x < 0 ? 0 : x >= width ? width - 1 : x;
    const cy = y < 0 ? 0 : y >= height ? height - 1 : y;
    return src[(cy * width + cx) * 4 + c];
  };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const centre = at(x, y, c);
        const sharpened =
          centre * 5 - at(x - 1, y, c) - at(x + 1, y, c) - at(x, y - 1, c) - at(x, y + 1, c);
        data[idx + c] = centre + (sharpened - centre) * amount;
      }
    }
  }
}

/* ------------------------------------------------------- rounded corners */

/** Radial path for the rounded-corner mask. */
export function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** Corner radius in pixels for a percentage (0–50) of the shorter side. */
export function cornerRadiusFor(percent: number, width: number, height: number): number {
  const p = Math.max(0, Math.min(50, percent));
  return Math.round((Math.min(width, height) * p) / 100);
}

export const isRasterImageFormat = (format: string): boolean =>
  ['jpg', 'jpeg', 'png', 'webp'].includes(format);
