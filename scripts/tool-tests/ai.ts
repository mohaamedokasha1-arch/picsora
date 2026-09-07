/**
 * Node-side helpers that let the test suite exercise the REAL AI upscaler.
 *
 * TensorFlow.js runs on its CPU backend (no native bindings needed) and the
 * model is read from `public/models/esrgan/` — the exact bytes the browser
 * fetches at `/models/esrgan/…` — through a filesystem IO handler. So the
 * tests cover the same code path, the same weights and the same tensor maths
 * as a real browser session; only the backend and the transport differ.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as tf from '@tensorflow/tfjs';
import type { ModelIoHandler, Tf, UpscaleFactor } from '@/lib/ai/upscaler';

export const MODELS_DIR = join(process.cwd(), 'public', 'models', 'esrgan');
export const FIXTURES_DIR = join(process.cwd(), 'scripts', 'tool-tests', 'fixtures');

/** TensorFlow.js on the CPU backend — deterministic and dependency-free. */
export async function cpuTf(): Promise<Tf> {
  await tf.setBackend('cpu');
  await tf.ready();
  if (tf.getBackend() !== 'cpu') throw new Error(`expected the cpu backend, got ${tf.getBackend()}`);
  return tf;
}

function readWhole(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  // A Node Buffer can be a view into a shared pool — copy out exactly our bytes.
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/** Filesystem IO handler for one vendored scale (x2 / x3 / x4). */
export function fileModelHandler(scale: UpscaleFactor): ModelIoHandler {
  const dir = join(MODELS_DIR, `x${scale}`);
  return {
    load: async () => {
      const json = JSON.parse(readFileSync(join(dir, 'model.json'), 'utf8')) as {
        modelTopology: object;
        weightsManifest: { weights: unknown[] }[];
      };
      return {
        modelTopology: json.modelTopology,
        weightSpecs: json.weightsManifest[0].weights,
        weightData: readWhole(join(dir, 'group1-shard1of1.bin')),
      };
    },
  };
}

/** Decode a PNG fixture into raw RGBA pixels. */
export async function rgbaOfPng(path: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  const { Canvas, loadImage } = await import('@napi-rs/canvas');
  const image = await loadImage(path);
  const canvas = new Canvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return {
    width: image.width,
    height: image.height,
    data: ctx.getImageData(0, 0, image.width, image.height).data,
  };
}

/** Crop a rectangle out of raw RGBA pixels (used to keep CPU inference quick). */
export function cropRgba(
  src: Uint8ClampedArray,
  srcWidth: number,
  x0: number,
  y0: number,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const from = ((y0 + y) * srcWidth + x0) * 4;
    out.set(src.subarray(from, from + width * 4), y * width * 4);
  }
  return out;
}
