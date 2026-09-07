/**
 * Output-format capability + fallback tests.
 *
 * These cover the class of bug that used to surface as the generic
 * "Something went wrong" panel (and, worse, as a `.webp` file whose bytes were
 * really PNG): a browser that cannot encode the requested container.
 *
 * The trick is that `scripts/tool-tests/browser-env.ts` gives us a real Skia
 * canvas, so the *only* thing we need to change is how that canvas answers
 * WebP requests — exactly what an old Safari or a hardened Firefox does:
 *
 *   • `toDataURL('image/webp')` answers with `data:image/png…`  ⇒ the probe
 *     must report "no WebP here".
 *   • `toBlob(cb, 'image/webp')` answers with PNG-typed bytes ⇒ the encoder must
 *     detect the lie, remember it, and deliver an honest `.png`.
 *   • `toBlob` answers with `null`                      ⇒ the tool must fall
 *     back instead of rejecting.
 *
 * Run with:  npx tsx scripts/tool-tests/format-support-tests.ts
 */
import { installBrowserEnv, inspectBlob } from './browser-env';

installBrowserEnv();

import { encodableFormat, encodeCanvas, decodeImage, supportsWebPEncode } from '@/lib/image/format';
import {
  blobMatchesFormat,
  formatCapability,
  isFormatEncodable,
  needsOpaqueBackground,
  resetFormatCapabilities,
  formatLabel,
  resolveEncodeFormat,
  type CanvasOutputFormat,
} from '@/lib/image/format-support';
import { readPixelsSafely, createCanvas } from '@/lib/image/process';
import { convertImage, convertMany } from '@/lib/tools/processors/convert';
import { compressImages } from '@/lib/tools/processors/compressor';
import { compressToExactSize } from '@/lib/tools/processors/exact-size';
import { resizeImage } from '@/lib/tools/processors/resizer';
import { makePhotoFile } from './testkit';
import { extractPalette } from '@/lib/tools/processors/palette';
import { assert, assertEq, test, summary } from './testkit';

/* ------------------------------------------------------------ shimming */

type CanvasProto = {
  toBlob: (cb: (b: Blob | null) => void, mime?: string, quality?: number) => void;
  toDataURL: (mime?: string, quality?: number) => string;
};

function canvasProto(): CanvasProto {
  const el = document.createElement('canvas') as unknown as object;
  return Object.getPrototypeOf(el) as CanvasProto;
}

const proto = canvasProto();
const originalToBlob = proto.toBlob;
const originalToDataURL = proto.toDataURL;

/** Safari 13/14: no WebP encoder at all — both APIs answer with PNG. */
function simulateNoWebPEncoder(): void {
  proto.toDataURL = function (this: CanvasProto, mime = 'image/png', quality?: number) {
    if (mime === 'image/webp') return originalToDataURL.call(this, 'image/png', quality);
    return originalToDataURL.call(this, mime, quality);
  };
  proto.toBlob = function (
    this: CanvasProto,
    cb: (b: Blob | null) => void,
    mime = 'image/png',
    quality?: number,
  ) {
    if (mime === 'image/webp') return originalToBlob.call(this, cb, 'image/png', quality);
    return originalToBlob.call(this, cb, mime, quality);
  };
  resetFormatCapabilities();
}

/**
 * The dangerous in-between case: the probe claims WebP works (its `toDataURL`
 * is labelled `image/webp`) but the *encoder* returns PNG bytes under the WebP
 * request. Real behaviour in some Safari 14 builds.
 */
function simulateLyingWebPEncoder(): void {
  // Probe API restored to the shim's default: it labels bytes with whatever mime
  // was asked for, i.e. it claims WebP support. Only the encoder knows better.
  proto.toDataURL = originalToDataURL;
  proto.toBlob = function (
    this: CanvasProto,
    cb: (b: Blob | null) => void,
    mime = 'image/png',
    quality?: number,
  ) {
    if (mime === 'image/webp') {
      return originalToBlob.call(this, (blob) => {
        cb(blob ? new Blob([blob], { type: 'image/png' }) : null);
      }, 'image/webp', quality);
    }
    return originalToBlob.call(this, cb, mime, quality);
  };
  resetFormatCapabilities();
}

/** `toBlob` hands back null (canvas evicted under memory pressure). */
function simulateNullEncode(mimeToFail: string): void {
  proto.toBlob = function (
    this: CanvasProto,
    cb: (b: Blob | null) => void,
    mime = 'image/png',
    quality?: number,
  ) {
    if (mime === mimeToFail) return cb(null);
    return originalToBlob.call(this, cb, mime, quality);
  };
  resetFormatCapabilities();
}

function restoreCanvas(): void {
  proto.toBlob = originalToBlob;
  proto.toDataURL = originalToDataURL;
  resetFormatCapabilities();
}

const decode = (file: File) => decodeImage(file);

interface FakeWorkerInstance {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { preventDefault(): void }) => void) | null;
  terminated: boolean;
}

/* ------------------------------------------------------------- the tests */

async function main() {
  console.log('\n🧪 capability layer (no-DOM safety, mapping rules)');

  await test('probes answer without throwing and are memoised', () => {
    const probes = ['jpg', 'png', 'webp', 'avif', 'gif', 'heic', 'nonsense', ''] as string[];
    for (const format of probes) {
      const capability = formatCapability(format as CanvasOutputFormat);
      assert(typeof capability.encodable === 'boolean', `${format}: encodable must be a boolean`);
      assert(typeof capability.alpha === 'boolean', `${format}: alpha must be a boolean`);
      assert(typeof capability.probed === 'boolean', `${format}: probed flag`);
    }
    assertEq(formatCapability('png'), formatCapability('png'), 'memoised');
    assertEq(formatLabel('webp'), 'WebP', 'human labels stay upper-case acronyms');
    assertEq(formatLabel('jpg'), 'JPG', 'jpg label');
  });

  await test('unwritable containers map to a safe label, never to themselves', () => {
    assertEq(resolveEncodeFormat('gif').format, 'png', 'gif → png');
    assertEq(resolveEncodeFormat('heic').format, 'jpg', 'heic → jpg (keeps the historical mapping)');
    assertEq(resolveEncodeFormat('heif').format, 'jpg', 'heif → jpg');
    assertEq(resolveEncodeFormat('  ').format, 'png', 'blank → png');
    assertEq(resolveEncodeFormat(null).format, 'png', 'null → png');
    assertEq(resolveEncodeFormat(undefined).format, 'png', 'undefined → png');
    assertEq(resolveEncodeFormat('GIF').format, 'png', 'case-insensitive');
    assertEq(resolveEncodeFormat('evil/../x').format, 'png', 'unknown container → png');
    assertEq(needsOpaqueBackground('jpg'), true, 'jpg needs flattening');
    assertEq(needsOpaqueBackground('png'), false, 'png keeps alpha');
  });

  await test('blobMatchesFormat only rejects an explicit mismatch', () => {
    assert(blobMatchesFormat(new Blob([], { type: 'image/png' }), 'png'), 'png/png');
    assert(!blobMatchesFormat(new Blob([], { type: 'image/png' }), 'webp'), 'png bytes for a webp request');
    assert(blobMatchesFormat(new Blob([], { type: '' }), 'webp'), 'engine that leaves type empty is not contradicted');
    assert(blobMatchesFormat(new Blob([], { type: 'image/jpeg' }), 'jpeg'), 'jpeg alias');
  });

  console.log('\n🧪 browsers without a WebP encoder (the reported crash)');

  simulateNoWebPEncoder();
  try {
    await test('the probe reports the missing encoder', () => {
      assertEq(supportsWebPEncode(), false, 'supportsWebPEncode');
      assertEq(isFormatEncodable('webp'), false, 'isFormatEncodable');
      assertEq(encodableFormat('webp'), 'png', 'encodableFormat falls back to png');
    });

    await test('jpg→webp converter delivers a valid PNG instead of dying', async () => {
      const file = await makePhotoFile('photo.jpg', 480, 360, 'image/jpeg', 0.9);
      const decoded = await decode(file);
      const result = await convertImage([decoded], { format: 'webp', quality: 90, background: '#ffffff' });
      const info = await inspectBlob(result.blob);
      assertEq(result.format, 'png', 'result reports the container it wrote');
      assertEq(result.fallbackFrom, 'webp', 'and says what was substituted');
      assertEq(result.name, 'photo.png', 'file name follows the real bytes');
      assertEq(info.mime, 'image/png', 'bytes really are PNG');
    });

    await test('batch conversion never rejects and never mislabels', async () => {
      const a = await makePhotoFile('a.jpg', 320, 240, 'image/jpeg', 0.9);
      const b = await makePhotoFile('b.jpg', 320, 240, 'image/jpeg', 0.9, 7);
      const results = await convertMany([await decode(a), await decode(b)], {
        format: 'webp',
        quality: 90,
        background: '#ffffff',
      });
      assertEq(results.length, 2, 'batch size');
      for (const r of results) {
        const info = await inspectBlob(r.blob);
        const ext = r.name.slice(r.name.lastIndexOf('.') + 1);
        assertEq(ext, info.mime === 'image/png' ? 'png' : info.mime.split('/')[1], `${r.name}: name matches bytes`);
      }
    });

    await test('compressor to WebP degrades to PNG rather than erroring', async () => {
      const file = await makePhotoFile('big.jpg', 900, 600, 'image/jpeg', 0.92);
      const results = await compressImages([await decode(file)], { quality: 70, format: 'webp' });
      assertEq(results.length >= 1, true, 'a result is produced');
      const first = results[0];
      const info = await inspectBlob(first.blob);
      assertEq(info.mime, 'image/png', 'png bytes');
      assert(first.name.endsWith('.png'), `name must match the bytes, got ${first.name}`);
      assertEq(first.fallbackFrom, 'webp', 'substitution reported');
    });

    await test('exact-KB still hits its target after the fallback', async () => {
      const file = await makePhotoFile('id.jpg', 1200, 900, 'image/jpeg', 0.95);
      const results = await compressToExactSize([await decode(file)], { targetKB: 120, format: 'webp' });
      const r = results[0];
      assert(r.hit, `target should still be reachable (got ${r.outputSize} of ${r.targetBytes})`);
      const info = await inspectBlob(r.blob);
      assertEq(info.mime, 'image/png', 'delivered as png');
      assert(r.name.endsWith('.png'), `name follows the container, got ${r.name}`);
      assertEq(r.fallbackFrom, 'webp', 'and reports the switch');
    });

    await test('resize keeps transparency when WebP quietly becomes PNG', async () => {
      const { makeTransparentPngFile } = await import('./testkit');
      const file = await makeTransparentPngFile('logo.png', 400, 300);
      const decoded = await decode(file);
      const result = await resizeImage([decoded], { width: 200, height: 150, format: 'webp' });
      const info = await inspectBlob(result.blob);
      assertEq(info.mime, 'image/png', 'png (alpha-capable), never an opaque surprise');
      assert(info.rgba[3] < 255, 'transparency must survive the fallback');
    });
  } finally {
    resetFormatCapabilities();
  }

  console.log('\n🧪 encoders that lie or return nothing');

  try {
    simulateLyingWebPEncoder();
    await test('a WebP answer containing PNG bytes is caught and relabelled', async () => {
      assertEq(supportsWebPEncode(), true, 'the probe alone is fooled…');
      const file = await makePhotoFile('tricky.jpg', 600, 400, 'image/jpeg', 0.9);
      const { canvas } = createCanvas(600, 400);
      const encoded = await encodeCanvas(canvas, { format: 'webp', quality: 0.9 });
      assertEq(encoded.format, 'png', '…but the encoder is not: it reports png');
      assertEq(encoded.fallbackFrom, 'webp', 'substitution reported');
      assertEq(encoded.blob.type, 'image/png', 'blob type agrees with the label');
      assertEq(supportsWebPEncode(), false, 'and the capability table self-corrects');
    });

    simulateNullEncode('image/webp');
    await test('toBlob returning null falls back instead of rejecting', async () => {
      const file = await makePhotoFile('dead.jpg', 320, 240, 'image/jpeg', 0.9);
      const decoded = await decode(file);
      const result = await convertImage([decoded], { format: 'webp', quality: 90, background: '#ffffff' });
      const info = await inspectBlob(result.blob);
      assertEq(info.mime, 'image/png', 'a real file is produced');
      assert(result.blob.size > 0, 'non-empty');
    });
    simulateNullEncode('image/png');
    await test('a dead PNG encode does not black-list PNG for the session', async () => {
      const file = await makePhotoFile('huge.png', 600, 400, 'image/png', 0.9);
      const decoded = await decode(file);
      // PNG answers null (memory pressure) → JPEG is tried and wins, but PNG
      // must stay "supported" so the next, smaller image is not silently
      // degraded to a lossy container.
      const result = await convertImage([decoded], { format: 'png', quality: 90, background: '#ffffff' });
      assertEq(result.format, 'jpg', 'this one image falls back to jpg');
      assertEq(result.fallbackFrom, 'png', 'and says so');
      assertEq(encodableFormat('png'), 'png', 'png capability survives');
    });
  } finally {
    restoreCanvas();
  }

  console.log('\n🧪 healthy browser: nothing changes (regression guard)');

  await test('WebP is still written as WebP when supported', async () => {
    assertEq(supportsWebPEncode(), true, 'probe restored');
    const file = await makePhotoFile('ok.jpg', 320, 240, 'image/jpeg', 0.9);
    const result = await convertImage([await decode(file)], { format: 'webp', quality: 90, background: '#fff' });
    const info = await inspectBlob(result.blob);
    assertEq(info.mime, 'image/webp', 'webp bytes');
    assertEq(result.format, 'webp', 'labelled webp');
    assertEq(result.fallbackFrom, undefined, 'no substitution to explain');
    assertEq(result.name, 'ok.webp', 'name keeps the requested container');
  });

  await test('pixels-unavailable is a labelled, actionable error', async () => {
    const { ctx } = createCanvas(64, 64);
    const good = readPixelsSafely(ctx, 64, 64, 'a.png');
    assertEq(good.width, 64, 'normal read works');
    const original = ctx.getImageData;
    (ctx as unknown as { getImageData: unknown }).getImageData = () => {
      throw new Error('IndexSizeError: canvas out of memory');
    };
    try {
      readPixelsSafely(ctx, 64, 64, 'huge.png');
      assert(false, 'must throw a labelled error');
    } catch (error) {
      const err = error as Error & { params?: Record<string, string | number> };
      assertEq(err.message, 'pixels-unavailable', 'key the UI maps to a sentence');
      assertEq(err.params?.file, 'huge.png', 'the offending file is named');
    } finally {
      (ctx as unknown as { getImageData: unknown }).getImageData = original;
    }
  });

  console.log('\n🧪 palette worker bridge (no permanent "Processing…" hang)');

  await test('every palette-worker failure settles with a labelled error', async () => {
    // One switch controls how the fake worker answers, so a worker instance
    // created inside the call below already obeys it.
    let behavior: 'reply' | 'error' | 'silent' = 'reply';
    const instances: FakeWorkerInstance[] = [];
    class FakeWorker {
      onmessage: ((event: { data: unknown }) => void) | null = null;
      onerror: ((event: { preventDefault(): void }) => void) | null = null;
      terminated = false;
      constructor() {
        instances.push(this);
      }
      postMessage(message: { id: number }) {
        const reply = (extra: Record<string, unknown>) => {
          const handler = this.onmessage;
          if (handler) handler({ data: { id: message.id, ...extra } });
        };
        if (behavior === 'error') reply({ error: 'median-cut crashed' });
        else if (behavior === 'silent') {
          /* the worker never answers */
        } else reply({ colors: [{ r: 255, g: 0, b: 0, share: 1 }] });
      }
      terminate() {
        this.terminated = true;
      }
    }
    (globalThis as unknown as { Worker: unknown }).Worker = FakeWorker;

    const file = await makePhotoFile('swatch.jpg', 320, 240, 'image/jpeg', 0.9);
    const decoded = [await decode(file)];
    const settleFast = <T>(
      promise: Promise<T>,
    ): Promise<{ status: 'ok'; value: T } | { status: 'error'; error: Error }> =>
      promise.then(
        (value) => ({ status: 'ok' as const, value }),
        (error: Error) => ({ status: 'error' as const, error }),
      );

    // 1. happy path — colours come back with hex values filled in.
    const ok = await settleFast(extractPalette(decoded, { count: 6 }));
    assertEq(ok.status, 'ok', 'a healthy worker resolves');
    if (ok.status === 'ok') {
      assertEq(ok.value.colors.length, 1, 'palette length');
      assertEq(ok.value.colors[0].hex.toLowerCase(), '#ff0000', 'hex derived from rgb');
    }

    // 2. worker-side exception ⇒ a real error, never an empty palette.
    behavior = 'error';
    const failed = await settleFast(extractPalette(decoded, { count: 6 }));
    assertEq(failed.status, 'error', 'worker errors reject');
    if (failed.status === 'error') {
      assertEq(failed.error.message, 'palette-failed', 'labelled key');
      const params = (failed.error as Error & { params?: Record<string, string | number> }).params;
      assert(String(params?.detail ?? '').includes('crashed'), 'the detail is preserved for the console');
    }

    // 3. load/runtime error ⇒ the wedged worker is discarded, not reused.
    instances[0].onerror?.({ preventDefault: () => {} });
    assertEq(instances[0].terminated, true, 'dead worker terminated');

    // 4. a worker that never answers must time out (timer shrunk for the test).
    behavior = 'silent';
    const originalSetTimeout = globalThis.setTimeout;
    (globalThis as unknown as { setTimeout: unknown }).setTimeout = (fn: () => void) =>
      originalSetTimeout(fn, 5);
    let stalled: { status: string; error?: Error } = { status: 'ok' };
    try {
      stalled = await settleFast(extractPalette(decoded, { count: 6 }));
    } finally {
      (globalThis as unknown as { setTimeout: unknown }).setTimeout = originalSetTimeout;
    }
    assertEq(stalled.status, 'error', 'a silent worker rejects instead of hanging');
    assertEq((stalled as { error?: Error }).error?.message, 'palette-timeout', 'timeout is its own actionable key');
    assert(instances.length >= 2, `the retired worker was replaced (instances: ${instances.length})`);

    // 5. Worker construction itself failing ⇒ reported, not queued forever.
    (globalThis as unknown as { Worker: unknown }).Worker = class {
      constructor() {
        throw new Error('Workers are blocked by policy');
      }
    };
    const blocked = await settleFast(extractPalette(decoded, { count: 6 }));
    assertEq(blocked.status, 'error', 'blocked workers reject');
    assertEq((blocked as { status: string; error?: Error }).error?.message, 'palette-unavailable', 'with a dedicated key');
  });

  process.exit(summary());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
