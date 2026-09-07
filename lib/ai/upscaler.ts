/**
 * On-device AI super-resolution powered by TensorFlow.js.
 *
 * The model is an ESRGAN generator (a TensorFlow.js *layers*-model) whose
 * weights are served from OUR OWN origin under `/models/esrgan/x{2,3,4}/` —
 * never from a third-party CDN — and inference runs on the visitor's WebGL
 * backend, falling back to the CPU backend when WebGL is unavailable. The
 * user's pixels are read from a canvas, transformed in memory and written
 * back to a canvas; nothing is ever uploaded.
 *
 * Memory strategy: the image is processed in tiles. Feeding a whole 12 MP
 * photo through a 12-layer CNN would need gigabytes of GPU memory, so the
 * input is split into `TILE_INPUT` blocks. Each block is padded with a
 * `TILE_OVERLAP` halo, and only the halo-free core of the network's output is
 * kept. Every convolution in this model is `padding: "same"` with a 3×3
 * kernel (12 of them ⇒ a 25 px input receptive field), so with an overlap of
 * 16 px the retained core is bit-comparable with a single full-image pass and
 * the tiles leave no seams.
 */

import type * as TF from '@tensorflow/tfjs';

/** The TensorFlow.js namespace — imported lazily so the bundle stays split. */
export type Tf = typeof TF;

export type UpscaleFactor = 2 | 3 | 4;

export const UPSCALE_FACTORS: UpscaleFactor[] = [2, 3, 4];

export interface UpscaleModelInfo {
  scale: UpscaleFactor;
  /** TF.js layers-model JSON on our own origin (see scripts/fetch-ai-models.mjs). */
  path: string;
  /** Weight payload size in bytes — shown to the user before the first run. */
  sizeBytes: number;
}

/**
 * Vendored ESRGAN "slim" generators (MIT, © Kevin Scott / UpscalerJS).
 * Kept in `public/models` so the tool works offline and without touching a
 * CDN; sizes are the on-disk `model.json` + weight shard for each scale.
 */
export const UPSCALE_MODELS: UpscaleModelInfo[] = [
  { scale: 2, path: '/models/esrgan/x2/model.json', sizeBytes: 900_636 },
  { scale: 3, path: '/models/esrgan/x3/model.json', sizeBytes: 919_596 },
  { scale: 4, path: '/models/esrgan/x4/model.json', sizeBytes: 946_140 },
];

export function modelInfoFor(scale: UpscaleFactor): UpscaleModelInfo {
  return UPSCALE_MODELS.find((m) => m.scale === scale) ?? UPSCALE_MODELS[0];
}

/* ------------------------------------------------------------------ limits */

/**
 * Output caps that are stricter than the site-wide canvas limits: a 4× upscale
 * of a 4000 px photo is a 64 MP bitmap, and browsers fall over somewhere
 * around 1 GB of RGBA. Beyond these numbers the tool refuses early with a
 * precise message instead of crashing the tab mid-run.
 */
export const MAX_OUTPUT_EDGE = 8000;
export const MAX_OUTPUT_PIXELS = 48_000_000;

export function assertUpscalableSize(width: number, height: number, scale: number, fileName?: string): void {
  const outW = Math.round(width * scale);
  const outH = Math.round(height * scale);
  if (outW > MAX_OUTPUT_EDGE || outH > MAX_OUTPUT_EDGE || outW * outH > MAX_OUTPUT_PIXELS) {
    const err = new Error('upscaler-too-large') as Error & { params?: Record<string, string | number> };
    err.params = {
      w: outW.toLocaleString('en-US'),
      h: outH.toLocaleString('en-US'),
      edge: MAX_OUTPUT_EDGE.toLocaleString('en-US'),
      file: fileName ?? '',
    };
    throw err;
  }
}

/* --------------------------------------------------------------- tf runtime */

let tfPromise: Promise<Tf> | null = null;

/**
 * Lazily import TensorFlow.js and pick a backend.
 * WebGL is by far the fastest path in a browser; when the GPU is missing or
 * blacklisted, TF.js keeps the CPU backend (slow, but the tool still works).
 */
export function getTf(): Promise<Tf> {
  if (!tfPromise) {
    tfPromise = (async () => {
      const tf = await import('@tensorflow/tfjs');
      try {
        await tf.setBackend('webgl');
      } catch {
        /* CPU backend is already registered — keep it. */
      }
      await tf.ready();
      return tf;
    })();
    // A failed import must not be cached forever (offline retry, etc.).
    tfPromise.catch(() => {
      tfPromise = null;
    });
  }
  return tfPromise;
}

export function backendName(tf: Tf): string {
  try {
    return tf.getBackend();
  } catch {
    return 'unknown';
  }
}

/**
 * Minimal structural type for a TF.js IO handler. The browser path uses a URL
 * string (fetched from our own origin); the Node test suite injects a handler
 * that reads the very same files from disk.
 */
export interface ModelIoHandler {
  load(): Promise<{
    modelTopology: object;
    weightSpecs?: unknown[];
    weightData?: ArrayBuffer;
  }>;
}

const modelCache = new Map<string, Promise<TF.LayersModel>>();

export interface LoadModelOptions {
  /** Reuse an already-imported TensorFlow.js instance (tests). */
  tf?: Tf;
  /** Override the model.json URL. */
  path?: string;
  /** Replace URL loading entirely with a custom handler (tests / offline). */
  ioHandler?: ModelIoHandler;
}

/** Load (and cache) the ESRGAN generator for a scale. */
export function loadUpscaleModel(scale: UpscaleFactor, options: LoadModelOptions = {}): Promise<TF.LayersModel> {
  const info = modelInfoFor(scale);
  const path = options.path ?? info.path;
  const key = options.ioHandler ? `handler:${path}` : path;
  const cached = modelCache.get(key);
  if (cached) return cached;

  const created = (async () => {
    const tf = options.tf ?? (await getTf());
    const handler = (options.ioHandler ?? path) as unknown as TF.io.IOHandler;
    return tf.loadLayersModel(handler);
  })();

  modelCache.set(key, created);
  created.catch(() => {
    if (modelCache.get(key) === created) modelCache.delete(key);
  });
  return created;
}

/* ------------------------------------------------------------- tiling maths */

/** Tile edge in INPUT pixels (128 ⇒ up to 512 px of output per tile at 4×). */
export const TILE_INPUT = 128;
/** Halo of extra input pixels fed to the network and discarded afterwards. */
export const TILE_OVERLAP = 16;

export interface TilePlan {
  total: number;
  tiles: {
    /** Core rectangle in INPUT pixels (the part of the output we keep). */
    x: number;
    y: number;
    w: number;
    h: number;
    /** Rectangle actually fed to the network, including the halo. */
    feedX: number;
    feedY: number;
    feedW: number;
    feedH: number;
  }[];
}

/** Pure tiling plan — unit-testable without TensorFlow.js. */
export function planTiles(width: number, height: number, tile = TILE_INPUT, overlap = TILE_OVERLAP): TilePlan {
  const tiles: TilePlan['tiles'] = [];
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      const w = Math.min(tile, width - x);
      const h = Math.min(tile, height - y);
      const feedX = Math.max(0, x - overlap);
      const feedY = Math.max(0, y - overlap);
      const feedW = Math.min(width, x + w + overlap) - feedX;
      const feedH = Math.min(height, y + h + overlap) - feedY;
      tiles.push({ x, y, w, h, feedX, feedY, feedW, feedH });
    }
  }
  return { total: tiles.length, tiles };
}

/** Clamp a network output in [0,1] to an 8-bit byte. */
function toByte(value: number): number {
  if (!(value > 0)) return 0; // also catches NaN
  if (value >= 1) return 255;
  return (value * 255 + 0.5) | 0;
}

/** Yield to the event loop so progress paints and the tab stays responsive. */
function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Run the super-resolution network over raw RGBA pixels.
 *
 * Returns a new RGBA buffer `scale` times larger in each dimension with the
 * alpha channel left fully opaque — callers that need to preserve transparency
 * blend their own alpha plane over it (see the upscaler processor).
 */
export async function upscalePixels(
  tf: Tf,
  model: TF.LayersModel,
  source: Uint8ClampedArray,
  width: number,
  height: number,
  scale: UpscaleFactor,
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8ClampedArray> {
  const outW = width * scale;
  const outH = height * scale;
  const out = new Uint8ClampedArray(outW * outH * 4);
  const plan = planTiles(width, height);
  let done = 0;

  for (const tile of plan.tiles) {
    // Pack the halo-padded RGB block as float32 in [0,1] (the model's input range).
    const rgb = new Float32Array(tile.feedW * tile.feedH * 3);
    for (let y = 0; y < tile.feedH; y += 1) {
      let si = ((tile.feedY + y) * width + tile.feedX) * 4;
      let di = y * tile.feedW * 3;
      for (let x = 0; x < tile.feedW; x += 1, si += 4, di += 3) {
        rgb[di] = source[si] / 255;
        rgb[di + 1] = source[si + 1] / 255;
        rgb[di + 2] = source[si + 2] / 255;
      }
    }

    const input = tf.tensor3d(rgb, [tile.feedH, tile.feedW, 3], 'float32').expandDims(0);
    const predicted = model.predict(input) as TF.Tensor;
    let data: Float32Array;
    try {
      data = new Float32Array(await predicted.data());
    } finally {
      input.dispose();
      predicted.dispose();
    }

    // Discard the halo, keep the core, in OUTPUT pixel space.
    const haloX = (tile.x - tile.feedX) * scale;
    const haloY = (tile.y - tile.feedY) * scale;
    const feedOutW = tile.feedW * scale;
    const coreOutW = tile.w * scale;
    const coreOutH = tile.h * scale;
    for (let y = 0; y < coreOutH; y += 1) {
      const di = ((tile.y * scale + y) * outW + tile.x * scale) * 4;
      let si = ((haloY + y) * feedOutW + haloX) * 3;
      for (let x = 0; x < coreOutW; x += 1, si += 3) {
        const off = di + x * 4;
        out[off] = toByte(data[si]);
        out[off + 1] = toByte(data[si + 1]);
        out[off + 2] = toByte(data[si + 2]);
        out[off + 3] = 255;
      }
    }

    done += 1;
    onProgress?.(done, plan.total);
    await yieldToUi();
  }

  return out;
}

/* ------------------------------------------------------------------ facade */

export type UpscaleStage = 'model' | 'run';

export interface UpscaleProgress {
  stage: UpscaleStage;
  /** 0..1 within the current stage. */
  ratio: number;
}

export interface UpscaleRunOptions {
  scale: UpscaleFactor;
  onProgress?: (progress: UpscaleProgress) => void;
  /** Test seam: an already-imported TensorFlow.js instance. */
  tf?: Tf;
  /** Test seam: custom model loader (filesystem-backed in the Node suite). */
  ioHandler?: ModelIoHandler;
}

export interface UpscaleRunResult {
  /** RGBA pixels of the upscaled image. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Backend that actually ran the inference (`webgl` / `cpu`). */
  backend: string;
}

/**
 * Super-resolve raw RGBA pixels end to end: import TF.js, load the model for
 * the requested scale (cached), run tiled inference and return RGB pixels.
 */
export async function upscaleRgba(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  options: UpscaleRunOptions,
): Promise<UpscaleRunResult> {
  if (width <= 0 || height <= 0) throw new Error('decode-failed');
  if (source.length < width * height * 4) throw new Error('decode-failed');

  options.onProgress?.({ stage: 'model', ratio: 0 });
  const tf = options.tf ?? (await getTf());
  const model = await loadUpscaleModel(options.scale, {
    tf,
    ioHandler: options.ioHandler,
  });
  options.onProgress?.({ stage: 'model', ratio: 1 });

  const data = await upscalePixels(tf, model, source, width, height, options.scale, (done, total) => {
    options.onProgress?.({ stage: 'run', ratio: total ? done / total : 1 });
  });

  return {
    data,
    width: width * options.scale,
    height: height * options.scale,
    backend: backendName(tf),
  };
}
