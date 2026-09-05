/**
 * PNG palette quantization Web Worker — weighted median cut.
 * Reference implementation lives in `lib/image/quantize.ts`; keep both in sync.
 */
'use strict';

const MAX_COLORS = 256;
const SHIFT = 3; // 8 - 5
const LEVELS = 32;
const HIST_SIZE = LEVELS * LEVELS * LEVELS;

self.onmessage = function (event) {
  const { id, buffer, width, height } = event.data;
  try {
    const rgba = new Uint8ClampedArray(buffer);
    const result = quantize(rgba, width, height, MAX_COLORS);
    if (!result) {
      self.postMessage({ id, error: 'quantize-failed' });
      return;
    }
    // Transfer the (potentially huge) index map back zero-copy.
    self.postMessage(
      {
        id,
        palette: result.palette,
        indices: result.indices,
        colors: result.colors,
      },
      [result.indices.buffer],
    );
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message ? err.message : err) });
  }
};

function quantize(data, width, height, maxColors) {
  const total = width * height;
  if (total <= 0) return null;

  const hist = new Uint32Array(HIST_SIZE);
  let visible = 0;
  for (let p = 0; p < total; p++) {
    const o = p * 4;
    if (data[o + 3] === 0) continue;
    hist[bucketOf(data[o], data[o + 1], data[o + 2])]++;
    visible++;
  }
  if (!visible) {
    return { palette: new Uint8Array([0, 0, 0]), indices: new Uint8Array(total), colors: 1 };
  }

  const buckets = [];
  for (let i = 0; i < HIST_SIZE; i++) if (hist[i] > 0) buckets.push(i);

  let boxes = [{ buckets, weight: visible }];
  let guard = 0;
  while (boxes.length < maxColors && guard < 512) {
    guard++;
    let widest = -1;
    let widestRange = -1;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.buckets.length < 2) continue;
      const range = bucketRange(box.buckets);
      if (range > widestRange) {
        widestRange = range;
        widest = i;
      }
    }
    if (widest < 0 || widestRange === 0) break;
    const box = boxes[widest];
    const channel = widestChannel(box.buckets);
    const sorted = box.buckets.slice().sort(function (a, b) {
      return channelValue(a, channel) - channelValue(b, channel);
    });
    let leftWeight = 0;
    let splitAt = sorted.length;
    for (let i = 0; i < sorted.length; i++) {
      leftWeight += hist[sorted[i]];
      if (leftWeight * 2 >= box.weight) {
        splitAt = i + 1;
        break;
      }
    }
    if (splitAt <= 0 || splitAt >= sorted.length) break;
    const left = sorted.slice(0, splitAt);
    const right = sorted.slice(splitAt);
    boxes.splice(
      widest,
      1,
      { buckets: left, weight: leftWeight },
      { buckets: right, weight: box.weight - leftWeight },
    );
  }

  const palette = new Uint8Array(maxColors * 3);
  for (let i = 0; i < boxes.length; i++) {
    const box = boxes[i];
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (const bucket of box.buckets) {
      const w = hist[bucket];
      r += ((bucket >> 10) & 31) * w;
      g += ((bucket >> 5) & 31) * w;
      b += (bucket & 31) * w;
      n += w;
    }
    if (!n) continue;
    palette[i * 3] = Math.round((r / n) * 8 + 4);
    palette[i * 3 + 1] = Math.round((g / n) * 8 + 4);
    palette[i * 3 + 2] = Math.round((b / n) * 8 + 4);
  }

  const nearest = new Uint16Array(HIST_SIZE);
  for (let bucket = 0; bucket < HIST_SIZE; bucket++) {
    const br = (bucket >> 10) & 31;
    const bg = (bucket >> 5) & 31;
    const bb = bucket & 31;
    let best = 0;
    let bestDist = Infinity;
    for (let c = 0; c < boxes.length; c++) {
      const pr = palette[c * 3] >> SHIFT;
      const pg = palette[c * 3 + 1] >> SHIFT;
      const pb = palette[c * 3 + 2] >> SHIFT;
      const dr = br - pr;
      const dg = bg - pg;
      const db = bb - pb;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        best = c;
      }
    }
    nearest[bucket] = best;
  }

  const indices = new Uint8Array(total);
  for (let p = 0; p < total; p++) {
    const o = p * 4;
    indices[p] = nearest[bucketOf(data[o], data[o + 1], data[o + 2])];
  }

  return { palette, indices, colors: boxes.length };
}

function bucketOf(r, g, b) {
  return ((r >> SHIFT) << 10) | ((g >> SHIFT) << 5) | (b >> SHIFT);
}

function channelValue(bucket, channel) {
  if (channel === 0) return (bucket >> 10) & 31;
  if (channel === 1) return (bucket >> 5) & 31;
  return bucket & 31;
}

function bucketRange(buckets) {
  let min = [31, 31, 31];
  let max = [0, 0, 0];
  for (const b of buckets) {
    const r = (b >> 10) & 31;
    const g = (b >> 5) & 31;
    const bl = b & 31;
    if (r < min[0]) min[0] = r;
    if (g < min[1]) min[1] = g;
    if (bl < min[2]) min[2] = bl;
    if (r > max[0]) max[0] = r;
    if (g > max[1]) max[1] = g;
    if (bl > max[2]) max[2] = bl;
  }
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

function widestChannel(buckets) {
  let min = [31, 31, 31];
  let max = [0, 0, 0];
  for (const b of buckets) {
    const r = (b >> 10) & 31;
    const g = (b >> 5) & 31;
    const bl = b & 31;
    if (r < min[0]) min[0] = r;
    if (g < min[1]) min[1] = g;
    if (bl < min[2]) min[2] = bl;
    if (r > max[0]) max[0] = r;
    if (g > max[1]) max[1] = g;
    if (bl > max[2]) max[2] = bl;
  }
  const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  if (ranges[0] >= ranges[1] && ranges[0] >= ranges[2]) return 0;
  if (ranges[1] >= ranges[2]) return 1;
  return 2;
}
