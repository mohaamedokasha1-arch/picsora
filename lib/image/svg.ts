/**
 * SVG helpers: safe parsing of intrinsic dimensions plus rasterisation via
 * the browser's own SVG renderer.
 *
 * Security: SVG uploads are already content-scanned by `validateSvgContent`
 * (no scripts, handlers, foreignObject or external references) before any of
 * this runs. As defence in depth, rasterisation goes through `<img>` (which
 * never executes scripts) and never through innerHTML/DOMParser insertion.
 */

export interface SvgSize {
  width: number;
  height: number;
  /** True when the size came from width/height attributes or viewBox. */
  intrinsic: boolean;
}

const MAX_SVG_BYTES = 2 * 1024 * 1024;

/** Extract a length attribute (`width="100"`, `width="100px"`) as pixels. */
function parseLength(value: string | null): number | null {
  if (!value) return null;
  const m = value.trim().match(/^([\d.]+)\s*(px)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 && n <= 16000 ? n : null;
}

/**
 * Read the opening `<svg …>` tag and resolve intrinsic dimensions from
 * width/height attributes, falling back to the viewBox aspect ratio.
 */
export function svgIntrinsicSize(source: string): SvgSize {
  const fallback: SvgSize = { width: 1024, height: 1024, intrinsic: false };
  const tag = source.slice(0, 16384).match(/<svg\b[^>]{0,4000}>/i);
  if (!tag) return fallback;
  const el = tag[0];
  const attr = (name: string): string | null => {
    const m = el.match(new RegExp(`${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
  };
  const w = parseLength(attr('width'));
  const h = parseLength(attr('height'));
  if (w && h) return { width: Math.round(w), height: Math.round(h), intrinsic: true };

  const vb = attr('viewBox') ?? attr('viewbox');
  const nums = vb ? vb.trim().split(/[\s,]+/).map(Number) : [];
  if (nums.length === 4 && nums.every((n) => Number.isFinite(n)) && nums[2] > 0 && nums[3] > 0) {
    const aspect = nums[2] / nums[3];
    if (w) return { width: Math.round(w), height: Math.round(w / aspect), intrinsic: true };
    if (h) return { width: Math.round(h * aspect), height: Math.round(h), intrinsic: true };
    // viewBox only: render long-edge at 1024 so tiny icons stay crisp.
    const longEdge = 1024;
    if (aspect >= 1) return { width: longEdge, height: Math.max(1, Math.round(longEdge / aspect)), intrinsic: true };
    return { width: Math.max(1, Math.round(longEdge * aspect)), height: longEdge, intrinsic: true };
  }
  if (w) return { width: Math.round(w), height: Math.round(w), intrinsic: false };
  if (h) return { width: Math.round(h), height: Math.round(h), intrinsic: false };
  return fallback;
}

/**
 * Normalise an SVG file for rasterisation: guarantee explicit width/height
 * (Firefox/Safari rasterise dimension-less SVGs at 0×0 or unpredictably) and
 * upscale tiny icons so conversions stay sharp. Returns a new File; the
 * original bytes are untouched when dimensions are already usable.
 */
export async function normalizeSvgFile(file: File, minEdge = 1024): Promise<{ file: File; width: number; height: number }> {
  let source: string;
  try {
    source = await file.slice(0, MAX_SVG_BYTES).text();
  } catch {
    throw new Error('decode-failed');
  }
  const size = svgIntrinsicSize(source);
  let { width, height } = size;
  // Upscale small artwork (favicons, logos) to at least minEdge on the short
  // edge — vectors scale losslessly, so this only adds sharpness.
  const shortEdge = Math.min(width, height);
  if (shortEdge < minEdge && shortEdge > 0) {
    const scale = minEdge / shortEdge;
    width = Math.min(16000, Math.round(width * scale));
    height = Math.min(16000, Math.round(height * scale));
  }
  const tag = source.match(/<svg\b[^>]{0,4000}>/i);
  if (!tag) throw new Error('decode-failed');
  let replacement = tag[0]
    .replace(/\s+width\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '')
    .replace(/\s+height\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
  replacement = replacement.replace(/<svg\b/i, `<svg width="${width}" height="${height}"`);
  const normalised = source.replace(tag[0], replacement);
  const name = file.name || 'image.svg';
  try {
    return {
      file: new File([normalised], name, { type: 'image/svg+xml', lastModified: file.lastModified || Date.now() }),
      width,
      height,
    };
  } catch {
    throw new Error('decode-failed');
  }
}

/**
 * Rasterise an SVG file to a canvas at an explicit pixel size.
 * `width`/`height` default to the intrinsic (normalised) dimensions.
 */
export async function rasterizeSvg(
  file: File,
  options: { width?: number; height?: number; background?: string | null } = {},
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number }> {
  const { file: normalised, width: intrinsicW, height: intrinsicH } = await normalizeSvgFile(file);
  const width = Math.max(1, Math.min(16000, Math.round(options.width ?? intrinsicW)));
  const height = Math.max(1, Math.min(16000, Math.round(options.height ?? intrinsicH)));
  if (width * height > 100_000_000) throw new Error('image-too-large');

  const url = URL.createObjectURL(normalised);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.decoding = 'async';
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode-failed'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no-2d-context');
    if (options.background) {
      ctx.fillStyle = options.background;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.drawImage(img, 0, 0, width, height);
    return { canvas, width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
