/**
 * Test-image builders + a tiny assert/test runner for the tool test suite.
 */
import { deflateSync } from 'node:zlib';
import { createCanvas, type Canvas } from '@napi-rs/canvas';
import sharp from 'sharp';

/** Encode a canvas with quality honoured (libvips), like a real browser. */
async function encode(canvas: Canvas, mime: 'image/jpeg' | 'image/png' | 'image/webp', quality = 0.92): Promise<Buffer> {
  const w = canvas.width;
  const h = canvas.height;
  const raw = Buffer.from(canvas.getContext('2d').getImageData(0, 0, w, h).data);
  const pipeline = sharp(raw, { raw: { width: w, height: h, channels: 4 } });
  const q = Math.round(quality * 100);
  if (mime === 'image/jpeg') return pipeline.jpeg({ quality: q }).toBuffer();
  if (mime === 'image/webp') return pipeline.webp({ quality: q }).toBuffer();
  return pipeline.png({ compressionLevel: 6, adaptiveFiltering: true }).toBuffer();
}

/* ------------------------------------------------------------ assertions */

let passed = 0;
let failed = 0;
const failures: string[] = [];
let currentTest = '';

export function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  currentTest = name;
  return (async () => {
    try {
      await fn();
      passed += 1;
      console.log(`  ✅ ${name}`);
    } catch (e) {
      failed += 1;
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${name}: ${msg}`);
      console.log(`  ❌ ${name}\n      ${msg}`);
    }
  })();
}

export function summary(): number {
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  return failed === 0 ? 0 : 1;
}

export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`${msg} (in "${currentTest}")`);
}

export function assertEq<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg}: expected ${String(expected)}, got ${String(actual)} (in "${currentTest}")`);
  }
}

export function assertNear(actual: number, expected: number, tolerance: number, msg: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg}: expected ~${expected}±${tolerance}, got ${actual} (in "${currentTest}")`);
  }
}

/* ------------------------------------------------------- image builders */

/** Deterministic PRNG so test images are reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A "photographic" image: smooth gradients + blobs + fine noise. Encodes to
 * realistic JPEG sizes (unlike flat colour blocks).
 */
export function makePhotoCanvas(width: number, height: number, seed = 42) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(seed);
  const g = ctx.createLinearGradient(0, 0, width, height);
  g.addColorStop(0, '#2b5876');
  g.addColorStop(0.5, '#4e4376');
  g.addColorStop(1, '#c06c84');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  for (let i = 0; i < 26; i += 1) {
    ctx.fillStyle = `rgba(${Math.floor(rand() * 255)},${Math.floor(rand() * 255)},${Math.floor(
      rand() * 255,
    )},${0.12 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.arc(rand() * width, rand() * height, 20 + rand() * (width / 6), 0, Math.PI * 2);
    ctx.fill();
  }
  // fine noise so JPEG/PNG encoders have real work to do
  const img = ctx.getImageData(0, 0, width, height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 46;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function makePhotoFile(
  name: string,
  width: number,
  height: number,
  mime: 'image/jpeg' | 'image/png' | 'image/webp',
  quality = 0.85,
  seed = 42,
): Promise<File> {
  const canvas = makePhotoCanvas(width, height, seed);
  const buf = await encode(canvas, mime, quality);
  return new File([new Uint8Array(buf)], name, { type: mime });
}

/** Transparent PNG: fully transparent except a solid red circle in the middle. */
export async function makeTransparentPngFile(name: string, width = 400, height = 300): Promise<File> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#e33';
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, Math.min(width, height) / 3, 0, Math.PI * 2);
  ctx.fill();
  const buf = await encode(canvas, 'image/png');
  return new File([new Uint8Array(buf)], name, { type: 'image/png' });
}

/** Asymmetric image: left half red, right half blue (for flip/rotate checks). */
export async function makeHalfFile(
  name: string,
  width = 400,
  height = 200,
  mime: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<File> {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#d22';
  ctx.fillRect(0, 0, width / 2, height);
  ctx.fillStyle = '#22d';
  ctx.fillRect(width / 2, 0, width / 2, height);
  const buf = await encode(canvas, mime, 0.95);
  return new File([new Uint8Array(buf)], name, { type: mime });
}

/* ------------------------------------------------- "already optimised" PNG */

function crc32(buf: Buffer): number {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let k = 0; k < 8; k += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/**
 * Build a PALETTE (colour-type 3) PNG from RGBA pixels with maximum deflate —
 * mimics what optimisers like TinyPNG produce for screenshots. Canvas
 * re-encodes always come out as RGBA PNGs and are typically LARGER than this,
 * which is exactly the real-world case where "compress PNG" must not silently
 * return the original file without telling the user.
 */
export function buildOptimisedPalettePng(rgba: Uint8Array, width: number, height: number): Buffer {
  const palette: number[][] = [];
  const indexByKey = new Map<number, number>();
  const indices = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p += 1) {
    const r = rgba[p * 4];
    const g = rgba[p * 4 + 1];
    const b = rgba[p * 4 + 2];
    // flatten alpha into the colour (test images are opaque or fully clear)
    const a = rgba[p * 4 + 3];
    const rr = a === 0 ? 255 : r;
    const gg = a === 0 ? 255 : g;
    const bb = a === 0 ? 255 : b;
    const key = (rr << 16) | (gg << 8) | bb;
    let idx = indexByKey.get(key);
    if (idx === undefined) {
      if (palette.length >= 256) throw new Error('too many colours for palette PNG builder');
      idx = palette.length;
      palette.push([rr, gg, bb]);
      indexByKey.set(key, idx);
    }
    indices[p] = idx;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 3; // colour type: palette
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const plte = Buffer.from(palette.flat());

  const stride = width + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * stride] = 0; // filter: none
    Buffer.from(indices.subarray(y * width, (y + 1) * width)).copy(raw, y * stride + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('PLTE', plte),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Screenshot-like PNG (a handful of flat UI colours) saved through the
 * palette optimiser above. Small on disk, big when a canvas re-encodes it.
 */
export function makeOptimisedScreenshotPngFile(name: string, width = 900, height = 620): File {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f5f6fa';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#273c75';
  ctx.fillRect(0, 0, width, 64);
  ctx.fillStyle = '#e1e6ef';
  ctx.fillRect(24, 88, width - 48, 200);
  ctx.fillStyle = '#44bd32';
  ctx.fillRect(24, 312, 260, 120);
  ctx.fillStyle = '#e84118';
  ctx.fillRect(308, 312, 260, 120);
  ctx.fillStyle = '#8c7ae6';
  ctx.fillRect(24, 456, width - 48, 140);
  const data = ctx.getImageData(0, 0, width, height).data;
  const png = buildOptimisedPalettePng(new Uint8Array(data), width, height);
  return new File([new Uint8Array(png)], name, { type: 'image/png' });
}
