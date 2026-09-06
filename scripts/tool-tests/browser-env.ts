/**
 * Minimal browser environment shim for running the site's image processors
 * inside Node.js. It maps the DOM APIs the processors rely on
 * (document.createElement('canvas'), Image, createImageBitmap, object URLs,
 * canvas.toBlob/toDataURL) onto @napi-rs/canvas, which implements the same
 * Skia-backed 2D canvas behaviour real browsers have.
 *
 * This lets us exercise the REAL processor modules (lib/tools/processors/*,
 * lib/image/*) end to end — decode → transform → encode — and assert on the
 * actual output bytes, exactly like a browser session would produce.
 */
import { Canvas, loadImage } from '@napi-rs/canvas';
import sharp from 'sharp';

/* ---------------------------------------------------------------- encoder */

/**
 * @napi-rs/canvas's own JPEG/WebP encoders ignore the quality argument, so we
 * encode through sharp (libvips): quality-monotonic output, exactly like real
 * browsers. Alpha compositing also matches Chrome: JPEG flattens onto BLACK —
 * the real-world behaviour the processors must defend against with an
 * explicit white background fill.
 */
async function encodeCanvas(canvas: Canvas, mime: string, quality?: number): Promise<Buffer> {
  const w = canvas.width;
  const h = canvas.height;
  if (w < 1 || h < 1) throw new Error('empty canvas');
  const ctx = canvas.getContext('2d');
  const raw = Buffer.from(ctx.getImageData(0, 0, w, h).data);
  const pipeline = sharp(raw, { raw: { width: w, height: h, channels: 4 } });
  const q = Math.round(Math.max(0, Math.min(1, quality ?? 0.92)) * 100);
  if (mime === 'image/jpeg') return pipeline.jpeg({ quality: q }).toBuffer();
  if (mime === 'image/webp') return pipeline.webp({ quality: q }).toBuffer();
  if (mime === 'image/png') return pipeline.png({ compressionLevel: 6, adaptiveFiltering: true }).toBuffer();
  throw new Error(`browser-env: unsupported encode mime ${mime}`);
}

/* ------------------------------------------------------------------ URLs */

const objectUrlRegistry = new Map<string, Blob>();
let objectUrlSeq = 0;

export function installBrowserEnv(): void {
  const g = globalThis as Record<string, unknown>;

  (URL as unknown as Record<string, unknown>).createObjectURL = (blob: Blob): string => {
    const u = `blob:mock/${++objectUrlSeq}`;
    objectUrlRegistry.set(u, blob);
    return u;
  };
  (URL as unknown as Record<string, unknown>).revokeObjectURL = (u: string): void => {
    objectUrlRegistry.delete(u);
  };

  /* ------------------------------------------------------------- canvas */

  /** Extends the native canvas so `ctx.drawImage(mockCanvas)` also works. */
  class MockHTMLCanvasElement extends Canvas {
    constructor(w = 1, h = 1) {
      super(w, h);
    }
    toBlob(
      cb: (blob: Blob | null) => void,
      mime = 'image/png',
      quality?: number,
    ): void {
      void encodeCanvas(this as unknown as Canvas, mime, quality)
        .then((buf) => cb(new Blob([new Uint8Array(buf)], { type: mime })))
        .catch(() => cb(null));
    }
    toDataURL(...args: unknown[]): string {
      // Synchronous shim good enough for feature detection (supportsWebPEncode).
      const mime = (args[0] as string) || 'image/png';
      try {
        const buf = (this as unknown as Canvas).toBuffer(mime as 'image/png');
        return `data:${mime};base64,${buf.toString('base64')}`;
      } catch {
        return `data:${mime};base64,`;
      }
    }
  }
  g.HTMLCanvasElement = MockHTMLCanvasElement;

  const downloadLog: { filename: string; size: number }[] = [];
  g.__downloadLog = downloadLog;

  class MockAnchor {
    href = '';
    download = '';
    rel = '';
    click(): void {
      const blob = objectUrlRegistry.get(this.href);
      downloadLog.push({ filename: this.download, size: blob?.size ?? -1 });
    }
    remove(): void {}
  }

  g.document = {
    createElement(tag: string) {
      if (tag === 'canvas') return new MockHTMLCanvasElement(1, 1);
      if (tag === 'a') return new MockAnchor();
      throw new Error(`browser-env: unexpected createElement('${tag}')`);
    },
    body: { appendChild() {}, removeChild() {} },
  };

  /* -------------------------------------------------------------- Image */

  class MockImage {
    naturalWidth = 0;
    naturalHeight = 0;
    width = 0;
    height = 0;
    complete = false;
    decoding = 'sync';
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private _src = '';
    native: Awaited<ReturnType<typeof loadImage>> | null = null;

    get src(): string {
      return this._src;
    }
    set src(u: string) {
      this._src = u;
      void (async () => {
        try {
          const blob = objectUrlRegistry.get(u);
          if (!blob) throw new Error(`browser-env: no blob registered for ${u}`);
          const buf = Buffer.from(await blob.arrayBuffer());
          const img = await loadImage(buf);
          this.native = img;
          this.naturalWidth = img.width;
          this.naturalHeight = img.height;
          this.width = img.width;
          this.height = img.height;
          this.complete = true;
          this.onload?.();
        } catch {
          this.onerror?.();
        }
      })();
    }
    async decode(): Promise<void> {
      /* pixels are already in memory once onload fired */
    }
  }
  g.Image = MockImage;

  /* --------------------------------------------------- createImageBitmap */

  g.createImageBitmap = async (source: unknown): Promise<unknown> => {
    if (source instanceof Blob) {
      const buf = Buffer.from(await source.arrayBuffer());
      return loadImage(buf);
    }
    if (source instanceof MockImage && source.native) return source.native;
    throw new Error('browser-env: createImageBitmap got an unsupported source');
  };

  // OffscreenCanvas intentionally left undefined so tests exercise the
  // universal HTMLCanvasElement encode path.
}

/** Decode the bytes of an image Blob and return basic facts about it. */
export async function inspectBlob(blob: Blob): Promise<{
  width: number;
  height: number;
  mime: string;
  rgba: Uint8Array;
}> {
  const buf = Buffer.from(await blob.arrayBuffer());
  const img = await loadImage(buf);
  const canvas = new Canvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height).data;
  const head = buf.subarray(0, 12);
  let mime = 'unknown';
  if (head[0] === 0x89 && head[1] === 0x50) mime = 'image/png';
  else if (head[0] === 0xff && head[1] === 0xd8) mime = 'image/jpeg';
  else if (head.subarray(0, 4).toString('latin1') === 'RIFF') mime = 'image/webp';
  else if (head.subarray(0, 4).toString('latin1') === '%PDF') mime = 'application/pdf';
  return { width: img.width, height: img.height, mime, rgba: new Uint8Array(data) };
}

export function pixelAt(
  rgba: Uint8Array,
  width: number,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const i = (y * width + x) * 4;
  return { r: rgba[i], g: rgba[i + 1], b: rgba[i + 2], a: rgba[i + 3] };
}
