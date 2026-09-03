/**
 * Palette extraction Web Worker — median-cut color quantization.
 * Receives raw RGBA pixels, replies with the dominant colors.
 */
'use strict';

const MAX_PIXELS = 200 * 200;

self.onmessage = function (event) {
  const data = event.data;
  try {
    const colors = extract(data.buffer, data.width, data.height, data.count);
    self.postMessage({ id: data.id, colors });
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err && err.message ? err.message : err) });
  }
};

function extract(buffer, width, height, count) {
  const rgba = new Uint8ClampedArray(buffer);
  const total = width * height;
  const step = Math.max(1, Math.floor(total / MAX_PIXELS));

  const pixels = [];
  for (let i = 0; i < total; i += step) {
    const o = i * 4;
    const a = rgba[o + 3];
    if (a < 125) continue; // skip transparent pixels
    pixels.push([rgba[o], rgba[o + 1], rgba[o + 2]]);
  }
  if (!pixels.length) {
    return [{ r: 255, g: 255, b: 255, share: 1 }];
  }

  // Median cut
  let boxes = [[...pixels]];
  while (boxes.length < count) {
    const widestIdx = boxes.reduce(
      (bestIdx, box, idx) => {
        const range = boxRange(box);
        return range > boxes[bestIdx][2] ? idx : bestIdx;
      },
      0,
    );
    const box = boxes[widestIdx];
    if (box.length < 2) break;
    // find channel with largest range
    const r = boxRange(box);
    const channel = boxChannel(box);
    if (r === 0) break;
    const sorted = box.sort((a, b) => a[channel] - b[channel]);
    const mid = Math.floor(sorted.length / 2);
    const left = sorted.slice(0, mid);
    const right = sorted.slice(mid);
    boxes.splice(widestIdx, 1, left, right);
  }

  // Average each box
  const results = boxes
    .map((box) => {
      const n = box.length;
      const sum = box.reduce(
        (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
        [0, 0, 0],
      );
      return {
        r: Math.round(sum[0] / n),
        g: Math.round(sum[1] / n),
        b: Math.round(sum[2] / n),
        share: n / pixels.length,
      };
    })
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, count);

  return results;
}

function boxRange(box) {
  if (!box.length) return 0;
  let min = [255, 255, 255];
  let max = [0, 0, 0];
  for (const p of box) {
    for (let c = 0; c < 3; c++) {
      if (p[c] < min[c]) min[c] = p[c];
      if (p[c] > max[c]) max[c] = p[c];
    }
  }
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]);
}

function boxChannel(box) {
  let min = [255, 255, 255];
  let max = [0, 0, 0];
  for (const p of box) {
    for (let c = 0; c < 3; c++) {
      if (p[c] < min[c]) min[c] = p[c];
      if (p[c] > max[c]) max[c] = p[c];
    }
  }
  const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return ranges.indexOf(Math.max(...ranges));
}
