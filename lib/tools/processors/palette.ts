import type { DecodedImage, PaletteColor } from '@/lib/types';
import { createCanvas, rgbToHex, readPixelsSafely } from '@/lib/image/process';

export interface PaletteOptions {
  count: number;
}

export interface PaletteOutput {
  colors: PaletteColor[];
}

/**
 * Median-cut extraction runs in a dedicated Web Worker (`/workers/palette.worker.js`)
 * so a 100-megapixel photo never freezes the UI thread.
 *
 * The bridge below is deliberately defensive, because the previous version had
 * two failure modes that were *worse* than an error message:
 *
 *  - `new Worker(...)` and `worker.onerror` were unhandled: if the worker script
 *    could not be fetched (offline, a blocked request, an extension) the promise
 *    handed to the UI never settled, so the tool sat on its progress spinner
 *    forever with no way out.
 *  - A worker-side error resolved with an EMPTY palette, which the UI rendered
 *    as "this image has no colours" instead of telling the user to retry.
 *
 * Now every path settles: creation failure, load failure, runtime failure and a
 * stalled worker all reject with a labelled error (mapped to a real sentence in
 * `components/tools/error-display.tsx`), the pending queue is drained, and the
 * dead worker is discarded so the next attempt starts from a clean slate.
 */

/** No reply within this window ⇒ treat the worker as wedged. */
const WORKER_TIMEOUT_MS = 20_000;
/** Consecutive load failures after which we stop trying (a 404 will not heal). */
const MAX_WORKER_LOAD_FAILURES = 2;

let worker: Worker | null = null;
let workersUnavailable = false;
let loadFailures = 0;
let seq = 0;

interface PendingRequest {
  resolve: (colors: PaletteColor[]) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

const pending = new Map<number, PendingRequest>();

function labelled(key: string, params?: Record<string, string | number>): Error {
  const error = new Error(key) as Error & { params?: Record<string, string | number> };
  if (params) error.params = params;
  return error;
}

/**
 * Create (or reuse) the worker. Returns null when Web Workers are not
 * available at all — the caller then reports it instead of hanging.
 */
function getWorker(): Worker | null {
  if (workersUnavailable) return null;
  if (worker) return worker;
  try {
    if (typeof Worker === 'undefined' || typeof document === 'undefined') {
      workersUnavailable = true;
      return null;
    }
    const instance = new Worker('/workers/palette.worker.js');
    instance.onmessage = (event: MessageEvent) => {
      const data = (event?.data ?? {}) as {
        id?: number;
        colors?: { r: number; g: number; b: number; share: number }[];
        error?: string;
      };
      const id = typeof data.id === 'number' ? data.id : 0;
      const entry = pending.get(id);
      if (!entry) return; // already timed out / rejected
      settle(id);
      loadFailures = 0; // a reply means the worker is alive
      if (data.error) {
        entry.reject(labelled('palette-failed', { detail: String(data.error) }));
        return;
      }
      entry.resolve(
        (Array.isArray(data.colors) ? data.colors : []).map((c) => ({
          r: c.r,
          g: c.g,
          b: c.b,
          hex: rgbToHex(c.r, c.g, c.b),
          share: c.share,
        })),
      );
    };
    instance.onerror = (event) => {
      // A failed script load or an uncaught worker error: fail every in-flight
      // request loudly and retire this worker instance, so the next attempt
      // builds a fresh one instead of posting into a dead port.
      try {
        event?.preventDefault?.();
      } catch {
        /* not cancelable in every engine */
      }
      loadFailures += 1;
      if (loadFailures >= MAX_WORKER_LOAD_FAILURES) workersUnavailable = true;
      breakWorker(instance);
      rejectAll(labelled('palette-unavailable'));
    };
    worker = instance;
    return instance;
  } catch {
    // Web Workers cannot be created here at all (blocked by an extension,
    // a frozen origin, …). Say so once instead of queueing forever.
    workersUnavailable = true;
    worker = null;
    return null;
  }
}

function settle(id: number): void {
  const entry = pending.get(id);
  if (!entry) return;
  pending.delete(id);
  if (entry.timer) clearTimeout(entry.timer);
}

function breakWorker(instance: Worker | null): void {
  if (!instance) return;
  try {
    instance.terminate();
  } catch {
    /* nothing left to clean up */
  }
  if (worker === instance) worker = null;
}

function rejectAll(error: Error): void {
  const queued = Array.from(pending.values());
  pending.clear();
  for (const entry of queued) {
    if (entry.timer) clearTimeout(entry.timer);
    entry.reject(error);
  }
}

function runInWorker(
  buffer: ArrayBuffer,
  width: number,
  height: number,
  count: number,
): Promise<PaletteColor[]> {
  return new Promise((resolve, reject) => {
    const instance = getWorker();
    if (!instance) {
      reject(labelled('palette-unavailable'));
      return;
    }
    const id = ++seq;
    const entry: PendingRequest = { resolve, reject, timer: null };
    entry.timer = setTimeout(() => {
      if (!pending.has(id)) return;
      settle(id);
      // The worker is not answering: retire it so the next run recreates it.
      breakWorker(instance);
      reject(labelled('palette-timeout'));
    }, WORKER_TIMEOUT_MS);
    pending.set(id, entry);
    try {
      instance.postMessage({ id, buffer, width, height, count }, [buffer]);
    } catch (error) {
      settle(id);
      reject(labelled('palette-unavailable', { detail: error instanceof Error ? error.message : '' }));
    }
  });
}

export async function extractPalette(
  files: DecodedImage[],
  options: PaletteOptions,
): Promise<PaletteOutput> {
  const decoded = files[0];
  if (!decoded) throw labelled('no-file');
  const count = Math.max(2, Math.min(10, Math.round(Number(options.count)) || 8));
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);
  const imageData = readPixelsSafely(ctx, decoded.width, decoded.height, decoded.file?.name);
  // Transfer a copy of the pixels to the worker (zero-copy on the wire).
  const buffer = imageData.data.buffer.slice(0);
  const colors = await runInWorker(buffer, decoded.width, decoded.height, count);
  return { colors };
}
