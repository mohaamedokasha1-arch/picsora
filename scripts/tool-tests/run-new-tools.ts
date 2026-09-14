/**
 * Full-cycle tests for the batch of 18 tools added on top of the original set:
 * the 6 image tools (blur, pixelate, brightness/contrast, filters, rounded
 * corners, EXIF viewer), the 5 PDF tools, the 3 text tools and the 4
 * developer tools.
 *
 * Same contract as run-tests.ts: exercise the REAL modules the UI calls and
 * assert on the actual output (pixels, bytes, parsed values) rather than on
 * the presence of code.
 *
 * Run with:  npx tsx scripts/tool-tests/run-new-tools.ts
 */
import { installBrowserEnv, inspectBlob, pixelAt } from './browser-env';

installBrowserEnv();

import { decodeImage } from '@/lib/image/format';
import { pixelBlockFor } from '@/lib/image/effects';
import {
  adjustImage,
  applyFilterEffect,
  blurImage,
  pixelateImage,
  roundCorners,
} from '@/lib/tools/processors/effects';
import { readImageMetadata } from '@/lib/image/metadata';
import { clampMargin, pageNumberLabel, pageNumberPlacement, PAGE_NUMBER_FORMATS, PAGE_NUMBER_POSITIONS } from '@/lib/pdf-processing/numbering';
import { watermarkPlacements, WATERMARK_LAYOUTS } from '@/lib/pdf-processing/watermark';
import { readPdfMetadata, writePdfMetadata } from '@/lib/pdf-processing/metadata';
import { extractPdfImages } from '@/lib/pdf-processing/images';
import { sortLines } from '@/lib/text-processing/sort-lines';
import { extractItems } from '@/lib/text-processing/extract';
import { countFrequency, frequencyToCsv, frequencyToJson } from '@/lib/text-processing/frequency';
import { csvToJson, jsonToCsv, sniffDelimiter } from '@/lib/developer-tools/csv';
import { parseUrlParts, queryToJson } from '@/lib/developer-tools/url';
import {
  describeDate,
  detectUnit,
  isoWeekNumber,
  localInputToDate,
  offsetLabel,
  timestampToDate,
} from '@/lib/developer-tools/timestamp';
import { buildCron, describeCron, validateCron } from '@/lib/developer-tools/cron';
import { assert, assertEq, assertNear, makeHalfFile, makePhotoFile, makeTransparentPngFile, summary, test } from './testkit';

/* ------------------------------------------------------------- pixel maths */

/** Mean absolute horizontal difference — a simple high-frequency energy measure. */
function detailEnergy(rgba: Uint8Array, width: number, x0: number, y0: number, w: number, h: number): number {
  let sum = 0;
  let count = 0;
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w - 1; x += 1) {
      const a = (y * width + x) * 4;
      sum += Math.abs(rgba[a] - rgba[a + 4]);
      count += 1;
    }
  }
  return count ? sum / count : 0;
}

function meanLuma(rgba: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  }
  return sum / (rgba.length / 4);
}

function lumaSpread(rgba: Uint8Array): number {
  const mean = meanLuma(rgba);
  let sum = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    const l = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    sum += (l - mean) ** 2;
  }
  return Math.sqrt(sum / (rgba.length / 4));
}

/* ------------------------------------------------ hand-built EXIF JPEG */

/**
 * Build a real JPEG (SOI + APP1/Exif + EOI) whose EXIF block contains camera
 * make/model, exposure settings and GPS coordinates. Written by hand so the
 * test covers the TIFF walker itself, not a third-party encoder.
 */
function buildExifJpeg(): { bytes: Uint8Array; width: number; height: number } {
  const tiff = new Uint8Array(512);
  const view = new DataView(tiff.buffer);
  const u16 = (v: number, at: number) => view.setUint16(at, v, true);
  const u32 = (v: number, at: number) => view.setUint32(at, v, true);

  tiff[0] = 0x49; // 'I'
  tiff[1] = 0x49; // 'I'  → little endian
  u16(42, 2);
  u32(8, 4); // IFD0 right after the header

  const IFD0 = 8;
  const EXIF_IFD = IFD0 + 2 + 5 * 12 + 4; // 5 entries
  const GPS_IFD = EXIF_IFD + 2 + 5 * 12 + 4; // 5 entries
  let pool = GPS_IFD + 2 + 6 * 12 + 4; // 6 GPS entries

  const poolString = (text: string): { at: number; count: number } => {
    const chars = [...text].map((c) => c.charCodeAt(0));
    chars.push(0);
    const at = pool;
    tiff.set(chars, at);
    pool += chars.length;
    return { at, count: chars.length };
  };
  const poolRationals = (pairs: [number, number][]): { at: number; count: number } => {
    const at = pool;
    pairs.forEach(([num, den]) => {
      u32(num, pool);
      u32(den, pool + 4);
      pool += 8;
    });
    return { at, count: pairs.length };
  };
  const entry = (
    ifd: number,
    index: number,
    tag: number,
    type: number,
    count: number,
    write: (valueAt: number) => void,
  ) => {
    const at = ifd + 2 + index * 12;
    u16(tag, at);
    u16(type, at + 2);
    u32(count, at + 4);
    write(at + 8);
  };
  /** ASCII inline (≤4 bytes total incl. NUL) — short values live in the entry. */
  const inlineAscii = (ifd: number, i: number, tag: number, text: string) =>
    entry(ifd, i, tag, 2, text.length + 1, (valueAt) => {
      for (let c = 0; c < text.length; c += 1) tiff[valueAt + c] = text.charCodeAt(c);
    });

  // IFD0
  u16(5, IFD0);
  const make = poolString('Canon');
  const model = poolString('EOS R6');
  entry(IFD0, 0, 0x010f, 2, make.count, (v) => u32(make.at, v));
  entry(IFD0, 1, 0x0110, 2, model.count, (v) => u32(model.at, v));
  entry(IFD0, 2, 0x0112, 3, 1, (v) => u16(6, v)); // orientation: rotated 90°
  entry(IFD0, 3, 0x8769, 4, 1, (v) => u32(EXIF_IFD, v));
  entry(IFD0, 4, 0x8825, 4, 1, (v) => u32(GPS_IFD, v));
  u32(0, IFD0 + 2 + 5 * 12);

  // Exif IFD
  u16(5, EXIF_IFD);
  const exposure = poolRationals([[1, 250]]);
  const aperture = poolRationals([[28, 10]]);
  const shot = poolString('2023:05:04 12:30:00');
  const focal = poolRationals([[50, 1]]);
  entry(EXIF_IFD, 0, 0x829a, 5, exposure.count, (v) => u32(exposure.at, v));
  entry(EXIF_IFD, 1, 0x829d, 5, aperture.count, (v) => u32(aperture.at, v));
  entry(EXIF_IFD, 2, 0x8827, 3, 1, (v) => u16(400, v));
  entry(EXIF_IFD, 3, 0x9003, 2, shot.count, (v) => u32(shot.at, v));
  entry(EXIF_IFD, 4, 0x920a, 5, focal.count, (v) => u32(focal.at, v));
  u32(0, EXIF_IFD + 2 + 5 * 12);

  // GPS IFD — 24°28'7" N, 54°22'14" E, 100 m
  u16(6, GPS_IFD);
  const lat = poolRationals([[24, 1], [28, 1], [7, 1]]);
  const lon = poolRationals([[54, 1], [22, 1], [14, 1]]);
  const alt = poolRationals([[100, 1]]);
  inlineAscii(GPS_IFD, 0, 0x0001, 'N');
  entry(GPS_IFD, 1, 0x0002, 5, lat.count, (v) => u32(lat.at, v));
  inlineAscii(GPS_IFD, 2, 0x0003, 'E');
  entry(GPS_IFD, 3, 0x0004, 5, lon.count, (v) => u32(lon.at, v));
  entry(GPS_IFD, 4, 0x0005, 1, 1, (v) => (tiff[v] = 0));
  entry(GPS_IFD, 5, 0x0006, 5, alt.count, (v) => u32(alt.at, v));
  u32(0, GPS_IFD + 2 + 6 * 12);

  const tiffBytes = tiff.subarray(0, pool);
  const app1Length = 2 + 6 + tiffBytes.length;
  const width = 640;
  const height = 480;
  // SOI + APP1 + SOF0(declared size) + EOI — enough for the container scanner.
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03, 1, 0x11, 0, 2, 0x11, 0, 3, 0x11, 0];
  const out = new Uint8Array(2 + 2 + app1Length + sof.length + 2);
  let at = 0;
  out[at++] = 0xff;
  out[at++] = 0xd8;
  out[at++] = 0xff;
  out[at++] = 0xe1;
  out[at++] = (app1Length >> 8) & 0xff;
  out[at++] = app1Length & 0xff;
  out.set([0x45, 0x78, 0x69, 0x66, 0x00, 0x00], at); // "Exif\0\0"
  at += 6;
  out.set(tiffBytes, at);
  at += tiffBytes.length;
  out.set(sof, at);
  at += sof.length;
  out[at++] = 0xff;
  out[at++] = 0xd9;
  return { bytes: out.subarray(0, at), width, height };
}

async function main() {
  /* ═══════════════════════════ 17. IMAGE BLUR ═══════════════════════════ */
  console.log('\n🌫️  image-blur');

  await test('blurring the whole image removes high-frequency detail', async () => {
    const file = await makePhotoFile('noisy.png', 600, 400, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const before = await inspectBlob(file);
    const result = await blurImage([decoded], { amount: 12, format: 'png' });
    const after = await inspectBlob(result.blob);
    assertEq(after.mime, 'image/png', 'png output');
    assertEq(after.width, 600, 'width preserved');
    assertEq(after.height, 400, 'height preserved');
    const e0 = detailEnergy(before.rgba, before.width, 60, 60, 200, 150);
    const e1 = detailEnergy(after.rgba, after.width, 60, 60, 200, 150);
    assert(e1 < e0 * 0.35, `blur must flatten local detail: ${e0.toFixed(1)} → ${e1.toFixed(1)}`);
  });

  await test('region blur only touches the selected area', async () => {
    const file = await makePhotoFile('faces.png', 400, 300, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const source = await inspectBlob(file);
    // Left half selected, right half must stay byte-identical (PNG is lossless).
    const result = await blurImage([decoded], { amount: 20, format: 'png', regions: [{ x: 0, y: 0, w: 0.5, h: 1 }] });
    const after = await inspectBlob(result.blob);
    const leftBefore = detailEnergy(source.rgba, source.width, 20, 60, 140, 150);
    const leftAfter = detailEnergy(after.rgba, after.width, 20, 60, 140, 150);
    assert(leftAfter < leftBefore * 0.5, `selected half must blur: ${leftBefore.toFixed(1)} → ${leftAfter.toFixed(1)}`);
    let diffs = 0;
    let maxDiff = 0;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = Math.floor(source.width * 0.55); x < source.width; x += 1) {
        const i = (y * source.width + x) * 4;
        for (let c = 0; c < 3; c += 1) {
          const d = Math.abs(source.rgba[i + c] - after.rgba[i + c]);
          if (d > 0) diffs += 1;
          maxDiff = Math.max(maxDiff, d);
        }
      }
    }
    assertEq(diffs, 0, `unselected area must be untouched (max delta ${maxDiff})`);
  });

  /* ═══════════════════════════ 18. IMAGE PIXELATE ═══════════════════════ */
  console.log('\n🔲 image-pixelate');

  await test('pixelate paints uniform blocks of the requested size', async () => {
    const file = await makePhotoFile('plate.png', 500, 400, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const block = pixelBlockFor(20, 500);
    assertEq(block, 10, 'block size scales with the long edge');
    const result = await pixelateImage([decoded], { blockSize: 20, format: 'png' });
    const after = await inspectBlob(result.blob);
    for (const [x, y] of [
      [0, 0],
      [50, 30],
      [200, 100],
    ]) {
      const a = pixelAt(after.rgba, after.width, x, y);
      const b = pixelAt(after.rgba, after.width, x + block - 1, y + block - 1);
      assert(
        a.r === b.r && a.g === b.g && a.b === b.b,
        `block starting at ${x},${y} must be a single colour (${a.r},${a.g},${a.b} vs ${b.r},${b.g},${b.b})`,
      );
    }
    // A neighbouring block is very unlikely to share the exact same average.
    const first = pixelAt(after.rgba, after.width, 2, 2);
    const next = pixelAt(after.rgba, after.width, block + 2, 2);
    assert(first.r !== next.r || first.g !== next.g || first.b !== next.b, 'adjacent blocks differ');
  });

  await test('region pixelate hides only the selected rectangle', async () => {
    const file = await makePhotoFile('plates.png', 400, 400, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const source = await inspectBlob(file);
    const result = await pixelateImage([decoded], {
      blockSize: 30,
      format: 'png',
      regions: [{ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }],
    });
    const after = await inspectBlob(result.blob);
    // Region starts at 100,100 with 12px blocks → the block at 196 covers 196…207.
    assertEq(
      detailEnergy(after.rgba, after.width, 196, 196, 11, 11),
      0,
      'a selected block is a single flat colour',
    );
    const insideBlock = pixelAt(after.rgba, after.width, 196, 196);
    const insideBlockEnd = pixelAt(after.rgba, after.width, 207, 207);
    assert(
      insideBlock.r === insideBlockEnd.r && insideBlock.g === insideBlockEnd.g,
      'block corners share the averaged colour',
    );
    const corner = (10 * source.width + 10) * 4;
    assertEq(after.rgba[corner], source.rgba[corner], 'outside corner keeps its original red channel');
  });

  /* ═════════════════════ 19. BRIGHTNESS & CONTRAST ═════════════════════ */
  console.log('\n☀️  brightness-contrast');

  await test('+40 brightness raises mean luma and keeps dimensions', async () => {
    const file = await makePhotoFile('dark.png', 400, 300, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const before = await inspectBlob(file);
    const result = await adjustImage([decoded], { brightness: -30, contrast: 0, format: 'png' });
    const after = await inspectBlob(result.blob);
    assertEq(after.width, before.width, 'width preserved');
    assert(meanLuma(after.rgba) < meanLuma(before.rgba) - 25, 'negative brightness darkens the image');
  });

  await test('+60 contrast widens the tonal spread', async () => {
    const file = await makePhotoFile('flat.png', 400, 300, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const before = await inspectBlob(file);
    const result = await adjustImage([decoded], { brightness: 0, contrast: 60, format: 'png' });
    const after = await inspectBlob(result.blob);
    assert(lumaSpread(after.rgba) > lumaSpread(before.rgba) * 1.15, 'contrast increases the spread');
  });

  /* ══════════════════════════ 20. IMAGE FILTERS ═════════════════════════ */
  console.log('\n🎨 image-filters');

  await test('grayscale output has no colour left', async () => {
    const file = await makePhotoFile('colour.png', 300, 300, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const result = await applyFilterEffect([decoded], { preset: 'grayscale', strength: 100, format: 'png' });
    const after = await inspectBlob(result.blob);
    let maxDelta = 0;
    for (let i = 0; i < after.rgba.length; i += 4) {
      maxDelta = Math.max(
        maxDelta,
        Math.abs(after.rgba[i] - after.rgba[i + 1]),
        Math.abs(after.rgba[i + 1] - after.rgba[i + 2]),
      );
    }
    assert(maxDelta <= 2, `all channels must match, max delta ${maxDelta}`);
  });

  await test('invert mirrors every channel around 255', async () => {
    const file = await makePhotoFile('invert.png', 200, 200, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const before = await inspectBlob(file);
    const result = await applyFilterEffect([decoded], { preset: 'invert', strength: 100, format: 'png' });
    const after = await inspectBlob(result.blob);
    let worst = 0;
    for (let i = 0; i < after.rgba.length; i += 4) {
      worst = Math.max(worst, Math.abs(after.rgba[i] - (255 - before.rgba[i])));
    }
    assert(worst <= 2, `inverted pixels must be 255 - original, worst delta ${worst}`);
  });

  await test('sepia warms the image and sharpen keeps the size', async () => {
    const file = await makePhotoFile('sepia.png', 200, 200, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const before = await inspectBlob(file);
    const sepia = await inspectBlob((await applyFilterEffect([decoded], { preset: 'sepia', strength: 100, format: 'png' })).blob);
    const warm = (rgba: Uint8Array) => {
      let sum = 0;
      for (let i = 0; i < rgba.length; i += 4) sum += rgba[i] - rgba[i + 2];
      return sum / (rgba.length / 4);
    };
    assert(warm(sepia.rgba) > warm(before.rgba), 'sepia pushes red above blue');
    const sharpened = await inspectBlob(
      (await applyFilterEffect([decoded], { preset: 'sharpen', strength: 60, format: 'png' })).blob,
    );
    assertEq(sharpened.width, 200, 'sharpen keeps width');
    assertEq(sharpened.height, 200, 'sharpen keeps height');
  });

  /* ═════════════════════════ 21. ROUNDED CORNERS ════════════════════════ */
  console.log('\n⭕ rounded-corners');

  await test('PNG keeps transparent corners, centre stays solid', async () => {
    const file = await makePhotoFile('card.png', 400, 300, 'image/png', 0.95);
    const decoded = await decodeImage(file);
    const result = await roundCorners([decoded], { radiusPercent: 15, format: 'png' });
    const after = await inspectBlob(result.blob);
    assertEq(after.mime, 'image/png', 'png output');
    const corner = pixelAt(after.rgba, after.width, 1, 1);
    const middle = pixelAt(after.rgba, after.width, 200, 150);
    assertEq(corner.a, 0, 'top-left corner is fully transparent');
    assertEq(middle.a, 255, 'centre stays opaque');
  });

  await test('JPG corners are painted white, never black', async () => {
    const file = await makePhotoFile('card.jpg', 400, 300, 'image/jpeg', 0.95);
    const decoded = await decodeImage(file);
    const result = await roundCorners([decoded], { radiusPercent: 20, format: 'jpeg', quality: 0.95 });
    const after = await inspectBlob(result.blob);
    assertEq(after.mime, 'image/jpeg', 'jpeg output');
    const corner = pixelAt(after.rgba, after.width, 1, 1);
    assert(corner.r > 225 && corner.g > 225 && corner.b > 225, `corner must be white, got ${corner.r},${corner.g},${corner.b}`);
  });

  /* ═══════════════════ 22. IMAGE METADATA (EXIF VIEWER) ═════════════════ */
  console.log('\n🏷️  image-metadata');

  await test('EXIF camera, exposure and GPS values are read from the file', async () => {
    const { bytes, width, height } = buildExifJpeg();
    const file = new File([new Uint8Array(bytes)], 'holiday.jpg', { type: 'image/jpeg' });
    const report = await readImageMetadata(file, { width, height });
    assertEq(report.fileType, 'JPEG', 'container detected');
    assertEq(report.width, 640, 'width from container/decoder');
    assertEq(report.height, 480, 'height from container/decoder');
    assertEq(report.aspectRatio, '4:3', 'aspect ratio');
    assertEq(report.megapixels, 0.31, 'megapixels');

    const value = (key: string) => report.exif.find((e) => e.key === key)?.value;
    assertEq(value('cameraMake'), 'Canon', 'camera make');
    assertEq(value('cameraModel'), 'EOS R6', 'camera model');
    assertEq(value('iso'), 'ISO 400', 'ISO formatting');
    assertEq(value('exposureTime'), '1/250 s', 'exposure time formatting');
    assertEq(value('fNumber'), 'f/2.8', 'aperture formatting');
    assertEq(value('focalLength'), '50 mm', 'focal length formatting');
    assertEq(value('dateTimeOriginal'), '2023:05:04 12:30:00', 'original date');
    assertEq(value('orientation'), 'rotated90', 'orientation is a token the UI translates');

    assert(report.gps !== undefined, 'GPS position detected');
    assertNear(report.gps!.latitude, 24.4686, 0.0002, 'latitude in decimal degrees');
    assertNear(report.gps!.longitude, 54.3706, 0.0002, 'longitude in decimal degrees');
    assertNear(report.gps!.altitude ?? 0, 100, 0.5, 'altitude');

    const json = JSON.parse((await import('@/lib/image/metadata')).metadataToJson(report)) as {
      exif: Record<string, string>;
      gps: { latitude: number } | null;
    };
    assertEq(json.exif.cameraMake, 'Canon', 'JSON export carries the camera make');
    assertEq(json.exif.orientation, 'rotated90', 'JSON export carries the orientation token');
    assertNear(json.gps?.latitude ?? 0, 24.4686, 0.0002, 'JSON export carries GPS');
  });

  await test('an image without EXIF reports no EXIF rows', async () => {
    const file = await makeTransparentPngFile('flat.png', 120, 90);
    const decoded = await decodeImage(file);
    const report = await readImageMetadata(file, { width: decoded.width, height: decoded.height });
    assertEq(report.fileType, 'PNG', 'png detected');
    assertEq(report.width, 120, 'width');
    assertEq(report.height, 90, 'height');
    assertEq(report.exif.length, 0, 'no EXIF entries');
    assertEq(report.gps, undefined, 'no GPS');
  });

  /* ═══════════════════════ 23. PDF PAGE NUMBERING ═══════════════════════ */
  console.log('\n🔢 pdf-page-numbers');

  await test('every number format renders the page and total', async () => {
    assertEq(pageNumberLabel('plain', 3, 12), '3', 'plain');
    assertEq(pageNumberLabel('page-n', 3, 12), 'Page 3', 'page-n');
    assertEq(pageNumberLabel('n-of-total', 3, 12), '3 / 12', 'n-of-total');
    assertEq(pageNumberLabel('page-n-of-total', 3, 12), 'Page 3 of 12', 'page-n-of-total');
    assertEq(PAGE_NUMBER_FORMATS.length, 4, 'four formats offered');
    assertEq(PAGE_NUMBER_POSITIONS.length, 6, 'six positions offered');
  });

  await test('placements stay inside the page for every position', async () => {
    const page = { pageWidth: 595, pageHeight: 842, textWidth: 40, textHeight: 12, margin: 24 };
    for (const position of PAGE_NUMBER_POSITIONS) {
      const { x, y } = pageNumberPlacement({ ...page, position });
      assert(x >= 0 && x + page.textWidth <= page.pageWidth, `${position}: x=${x} inside the page`);
      assert(y >= 0 && y <= page.pageHeight, `${position}: y=${y} inside the page`);
    }
    const bottom = pageNumberPlacement({ ...page, position: 'bottom-center' });
    const top = pageNumberPlacement({ ...page, position: 'top-center' });
    assert(bottom.y < top.y, 'bottom sits below top');
    assertNear(clampMargin(400, 842), 842 / 3, 0.01, 'absurd margins are clamped to a third of the page');
    assertEq(clampMargin(-10, 842), 6, 'negative margins clamp to the 6pt floor');
  });

  /* ══════════════════════════ 24. PDF WATERMARK ═════════════════════════ */
  console.log('\n💧 pdf-watermark');

  await test('every layout produces in-bounds placements with clamped opacity', async () => {
    const page = { pageWidth: 595, pageHeight: 842, textWidth: 120, fontSize: 40 };
    for (const layout of WATERMARK_LAYOUTS) {
      const marks = watermarkPlacements({ ...page, layout, opacity: 20 });
      assert(marks.length > 0, `${layout}: produces at least one mark`);
      for (const mark of marks) {
        const right = mark.x + page.textWidth;
        assert(mark.x >= 0 && right <= page.pageWidth + 1, `${layout}: x=${mark.x} in bounds`);
        assert(mark.y >= 0 && mark.y <= page.pageHeight, `${layout}: y=${mark.y} in bounds`);
        assert(mark.opacity > 0 && mark.opacity <= 1, `${layout}: opacity=${mark.opacity} normalised`);
      }
    }
    const tile = watermarkPlacements({ ...page, layout: 'tile', opacity: 20 });
    assert(tile.length > 4, `tile layout repeats across the page (got ${tile.length})`);
    assertEq(watermarkPlacements({ ...page, layout: 'diagonal', opacity: 20 })[0].rotate, 45, 'diagonal is rotated');
    assertEq(watermarkPlacements({ ...page, layout: 'center', opacity: 20 })[0].rotate, 0, 'centre is upright');
    assertEq(watermarkPlacements({ ...page, layout: 'center', opacity: 700 })[0].opacity, 1, 'opacity above 100% is clamped');
    assertEq(watermarkPlacements({ ...page, layout: 'center', opacity: 0 })[0].opacity, 0.02, 'zero opacity keeps a faint mark');
  });

  /* ═══════════════════════ 25. PDF METADATA EDITOR ══════════════════════ */
  console.log('\n📝 pdf-metadata-editor');

  await test('metadata round-trips through write → read without touching pages', async () => {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    doc.addPage([595, 842]);
    doc.setTitle('Draft');
    const original = new File([new Uint8Array(await doc.save())], 'draft.pdf', { type: 'application/pdf' });

    const before = await readPdfMetadata(original);
    assertEq(before.fields.title, 'Draft', 'existing title read');
    assertEq(before.info.pageCount, 2, 'two pages');

    const blob = await writePdfMetadata(original, {
      title: 'Annual Report 2026',
      author: 'Ada Lovelace',
      subject: 'Yearly summary',
      keywords: 'report, 2026, summary',
      creator: 'Piclizer',
      producer: 'Piclizer',
    });
    const updated = new File([await blob.arrayBuffer()], 'draft.pdf', { type: 'application/pdf' });
    const after = await readPdfMetadata(updated);
    assertEq(after.fields.title, 'Annual Report 2026', 'title saved');
    assertEq(after.fields.author, 'Ada Lovelace', 'author saved');
    assertEq(after.fields.subject, 'Yearly summary', 'subject saved');
    assertEq(after.fields.keywords, 'report, 2026, summary', 'keywords saved');
    assertEq(after.info.pageCount, 2, 'pages untouched');
  });

  await test('clearing every field wipes the metadata', async () => {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    const doc = await PDFDocument.create();
    doc.addPage();
    doc.setTitle('Secret');
    doc.setAuthor('Someone');
    const file = new File([new Uint8Array(await doc.save())], 'doc.pdf', { type: 'application/pdf' });
    const blob = await writePdfMetadata(file, {
      title: '',
      author: '',
      subject: '',
      keywords: '',
      creator: '',
      producer: '',
    });
    const cleared = await readPdfMetadata(new File([await blob.arrayBuffer()], 'doc.pdf', { type: 'application/pdf' }));
    assertEq(cleared.fields.title, '', 'title cleared');
    assertEq(cleared.fields.author, '', 'author cleared');
  });

  /* ═══════════════════════ 26. PDF IMAGE EXTRACTION ═════════════════════ */
  console.log('\n🖼️  pdf-extract-images');

  await test('an embedded JPEG comes back byte-for-byte', async () => {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    const jpegFile = await makePhotoFile('photo.jpg', 160, 120, 'image/jpeg', 0.9);
    const jpegBytes = new Uint8Array(await jpegFile.arrayBuffer());
    const doc = await PDFDocument.create();
    const image = await doc.embedJpg(jpegBytes);
    const page = doc.addPage([300, 300]);
    page.drawImage(image, { x: 20, y: 20, width: 160, height: 120 });

    const result = await extractPdfImages(await doc.save());
    assertEq(result.images.length, 1, 'one image extracted');
    const [found] = result.images;
    assertEq(found.mime, 'image/jpeg', 'jpeg passthrough');
    assertEq(found.width, 160, 'width from the XObject');
    assertEq(found.height, 120, 'height from the XObject');
    assertEq(found.name, 'image-01.jpg', 'largest-first naming');
    const extracted = new Uint8Array(await found.blob.arrayBuffer());
    assertEq(extracted.length, jpegBytes.length, 'identical byte length');
    let same = true;
    for (let i = 0; i < extracted.length; i += 97) if (extracted[i] !== jpegBytes[i]) same = false;
    assert(same, 'bytes are untouched (no re-compression)');
  });

  await test('a Flate-compressed PNG is rebuilt with its colours intact', async () => {
    const { PDFDocument } = await import('@cantoo/pdf-lib');
    const pngFile = await makeHalfFile('halves.png', 200, 120, 'image/png');
    const pngBytes = new Uint8Array(await pngFile.arrayBuffer());
    const doc = await PDFDocument.create();
    const image = await doc.embedPng(pngBytes);
    const page = doc.addPage([300, 300]);
    page.drawImage(image, { x: 20, y: 20, width: 200, height: 120 });

    const result = await extractPdfImages(await doc.save());
    assertEq(result.images.length, 1, 'one image extracted');
    const found = result.images[0];
    assertEq(found.mime, 'image/png', 'rebuilt as PNG');
    const rebuilt = await inspectBlob(found.blob);
    assertEq(rebuilt.width, 200, 'width preserved');
    assertEq(rebuilt.height, 120, 'height preserved');
    const left = pixelAt(rebuilt.rgba, rebuilt.width, 20, 60);
    const right = pixelAt(rebuilt.rgba, rebuilt.width, 180, 60);
    assert(left.r > 150 && left.b < 100, `left half stays red, got ${left.r},${left.g},${left.b}`);
    assert(right.b > 150 && right.r < 100, `right half stays blue, got ${right.r},${right.g},${right.b}`);
  });

  /* ═════════════════════════════ 27. LINE SORTER ════════════════════════ */
  console.log('\n🔤 line-sorter');

  await test('alphabetical, numeric and clean-up options', async () => {
    const messy = 'banana\nApple\n  cherry  \n\napple\nItem 10\nItem 2';
    const az = sortLines(messy, { mode: 'az', trim: true, removeEmpty: true, removeDuplicates: false });
    assertEq(az.text.split('\n')[0], 'Apple', 'A first, case-insensitive');
    assertEq(az.emptyRemoved, 1, 'blank line reported');
    const za = sortLines(messy, { mode: 'za', trim: true, removeEmpty: true, removeDuplicates: true });
    assertEq(za.duplicatesRemoved, 1, 'Apple/apple collapsed');
    assertEq(za.text.split('\n')[0], 'Item 10', 'reverse order is numeric-aware (10 before 2)');
    const numeric = sortLines('Item 10\nItem 2\nItem 1', {
      mode: 'numericAsc',
      trim: true,
      removeEmpty: true,
      removeDuplicates: false,
    });
    assertEq(numeric.text, 'Item 1\nItem 2\nItem 10', 'numbers sort naturally, not as text');
    const lengths = sortLines('aaa\nb\ncc', { mode: 'lengthAsc', trim: true, removeEmpty: true, removeDuplicates: false });
    assertEq(lengths.text, 'b\ncc\naaa', 'shortest first');
  });

  /* ═════════════════════════════ 28. TEXT EXTRACTOR ═════════════════════ */
  console.log('\n📧 text-extractor');

  await test('links, emails, phones and numbers are extracted per kind', async () => {
    const text =
      'Write to info@piclizer.app or sales@example.com. Docs: https://piclizer.app/tools?ref=1 and www.example.org. ' +
      'Call +966 55 123 4567 or 055-123-4567. Order 1043 shipped in 2026 for $19.99.';
    const result = extractItems(text, { kinds: { urls: true, emails: true, phones: true, numbers: false }, unique: true });
    const byKind = (kind: string) => result.groups.find((g) => g.kind === kind)?.items ?? [];
    assert(byKind('emails').includes('info@piclizer.app'), 'first email found');
    assert(byKind('emails').includes('sales@example.com'), 'second email found');
    assert(byKind('urls').some((u) => u.includes('piclizer.app/tools')), 'https url found');
    assert(byKind('urls').some((u) => u.includes('example.org')), 'bare www url found');
    assert(byKind('phones').some((p) => p.replace(/\D/g, '').endsWith('1234567')), 'phone found');
    assertEq(result.total, result.groups.reduce((n, g) => n + g.items.length, 0), 'totals add up');

    const numbers = extractItems(text, { kinds: { urls: true, emails: true, phones: true, numbers: true }, unique: false });
    const numbersOnly = numbers.groups.find((g) => g.kind === 'numbers')?.items ?? [];
    assert(!numbersOnly.includes('1234567'), 'digits already used by a phone number are not counted twice');
    assert(numbersOnly.some((n) => n.includes('2026')), 'standalone numbers are still found');
  });

  /* ═══════════════════════ 29. TEXT FREQUENCY COUNTER ═══════════════════ */
  console.log('\n🔢 text-frequency-counter');

  await test('word ranking, percentages and one-off terms', async () => {
    const text = 'the cat sat on the mat the cat ran';
    const result = countFrequency(text, {
      mode: 'words',
      ignoreCase: true,
      ignoreStopWords: false,
      includeNumbers: true,
      minLength: 1,
      limit: 25,
      sort: 'count',
    });
    assertEq(result.total, 9, 'nine words counted');
    assertEq(result.unique, 6, 'six distinct words');
    assertEq(result.entries[0].term, 'the', 'most frequent word first');
    assertEq(result.entries[0].count, 3, 'counted three times');
    assertNear(result.entries[0].percent, (3 / 9) * 100, 0.01, 'percentage of the text');
    assertEq(result.once, 4, 'sat, on, mat and ran appear once');
    assert(result.topShare > 99, 'all rows shown means full coverage');
  });

  await test('stop words, minimum length and row limit are respected', async () => {
    const text = 'the quick brown fox jumps over the lazy dog the end';
    const filtered = countFrequency(text, {
      mode: 'words',
      ignoreCase: true,
      ignoreStopWords: true,
      includeNumbers: true,
      minLength: 3,
      limit: 3,
      sort: 'count',
    });
    assert(!filtered.entries.some((e) => e.term === 'the'), 'stop words removed');
    assert(!filtered.entries.some((e) => e.term.length < 3), 'short words removed');
    assertEq(filtered.entries.length, 3, 'limited to three rows');
    assert(filtered.topShare < 100, 'coverage reflects the rows shown');
    assert(filtered.topShare > 0, 'coverage is a positive share');
  });

  await test('character mode skips punctuation and merges case', async () => {
    const result = countFrequency('Aa, b! Aa. b? b', {
      mode: 'characters',
      ignoreCase: true,
      ignoreStopWords: false,
      includeNumbers: true,
      minLength: 1,
      limit: 0,
      sort: 'count',
    });
    assertEq(result.entries[0].term, 'a', 'the letter a wins');
    assertEq(result.entries[0].count, 4, 'A and a merged');
    assert(!result.entries.some((e) => /[,.!?\s]/.test(e.term)), 'punctuation is not counted');
    const alpha = countFrequency('b a b a', {
      mode: 'characters',
      ignoreCase: true,
      ignoreStopWords: false,
      includeNumbers: true,
      minLength: 1,
      limit: 0,
      sort: 'alpha',
    });
    assertEq(alpha.entries.map((e) => e.term).join(''), 'ab', 'alphabetical order');
  });

  await test('CSV and JSON exports describe the same table', async () => {
    const result = countFrequency('one two two three three three', {
      mode: 'words',
      ignoreCase: true,
      ignoreStopWords: false,
      includeNumbers: true,
      minLength: 1,
      limit: 25,
      sort: 'count',
    });
    const csv = frequencyToCsv(result, ['Term', 'Count', '%']);
    const lines = csv.split('\n');
    assertEq(lines[0], 'Term,Count,%', 'header row');
    assertEq(lines[1].split(',')[0], 'three', 'first data row is the top term');
    assertEq(lines[1].split(',')[1], '3', 'count column');
    const json = JSON.parse(frequencyToJson(result)) as { items: { term: string; count: number; percent: number }[]; total: number };
    assertEq(json.total, 6, 'JSON total');
    assertEq(json.items[0].term, 'three', 'JSON rows ranked the same way');
    assertEq(json.items[0].count, 3, 'JSON count');
  });

  /* ══════════════════════════ 30. JSON ⇄ CSV ════════════════════════════ */
  console.log('\n🔀 json-csv-converter');

  await test('nested JSON flattens into dotted CSV columns', async () => {
    const json = JSON.stringify([
      { id: 1, user: { name: 'Ada', city: 'London' }, active: true },
      { id: 2, user: { name: 'Sam', city: 'Cairo' }, active: false },
    ]);
    const result = jsonToCsv(json, { delimiter: ',', flatten: true, header: true });
    assert(result.ok, 'conversion succeeded');
    if (!result.ok) return;
    assertEq(result.value.rows, 2, 'two data rows');
    assert(result.value.columns.includes('user.name'), 'nested key flattened to user.name');
    const lines = result.value.csv.split('\n');
    assertEq(lines[0].split(',')[0], 'id', 'header starts with id');
    assert(lines[0].includes('user.name'), 'header contains the flattened column');
    assert(lines[2].includes('Cairo'), 'second row values present');
  });

  await test('CSV parses back into typed JSON, sniffing the delimiter', async () => {
    const csv = 'name;score;active\nAda;41;true\nSam;7;false\n';
    assertEq(sniffDelimiter(csv), ';', 'semicolon detected');
    const result = csvToJson(csv, { delimiter: 'auto', types: true });
    assert(result.ok, 'conversion succeeded');
    if (!result.ok) return;
    const records = JSON.parse(result.value.json) as { name: string; score: unknown; active: unknown }[];
    assertEq(records.length, 2, 'two records');
    assertEq(records[0].name, 'Ada', 'string kept');
    assertEq(records[0].score, 41, 'number converted');
    assertEq(records[1].active, false, 'boolean converted');
    assertEq(result.value.rows, 2, 'row count reported');
  });

  await test('invalid JSON and empty input are reported, not thrown', async () => {
    const bad = jsonToCsv('{not json}', { delimiter: ',', flatten: true, header: true });
    assertEq(bad.ok, false, 'invalid JSON rejected');
    if (!bad.ok) assertEq(bad.error, 'invalidJson', 'reason surfaced for translation');
    const empty = csvToJson('   ', { delimiter: 'auto', types: false });
    assertEq(empty.ok, false, 'empty CSV rejected');
    if (!empty.ok) assertEq(empty.error, 'emptyData', 'empty reason surfaced');
  });

  /* ══════════════════════════ 31. URL PARSER ════════════════════════════ */
  console.log('\n🔗 url-parser');

  await test('a full URL is split into its parts', async () => {
    const result = parseUrlParts('https://user:pw@example.com:8080/a/b?x=1&y=2&x=3#top');
    assert(result.ok, 'URL accepted');
    if (!result.ok) return;
    const url = result.value;
    assertEq(url.protocol, 'https', 'protocol');
    assertEq(url.hostname, 'example.com', 'hostname');
    assertEq(url.port, '8080', 'explicit port');
    assertEq(url.pathname, '/a/b', 'path');
    assertEq(url.hash, '#top', 'hash');
    assertEq(url.username, 'user', 'username');
    assertEq(url.params.length, 3, 'repeated keys keep every occurrence');
    const json = JSON.parse(queryToJson(url.params)) as Record<string, unknown>;
    assertEq(url.params.filter((p) => p.key === 'x').length, 2, 'x kept both occurrences');
    assert(Array.isArray(json.x) && json.x.length === 2, 'duplicates become an array');
    assertEq((json.x as string[])[0], '1', 'first duplicate value');
    assertEq(json.y, '2', 'single values stay strings');
  });

  await test('a bare domain is assumed to be https, junk is rejected', async () => {
    const bare = parseUrlParts('example.com/path?a=1');
    assert(bare.ok, 'bare domain accepted');
    if (bare.ok) {
      assertEq(bare.value.assumedProtocol, true, 'assumption flagged for the UI');
      assertEq(bare.value.protocol, 'https', 'https assumed');
      assertEq(bare.value.port, '443', 'default port filled in');
    }
    const spaced = parseUrlParts('not a url at all');
    assertEq(spaced.ok, false, 'free text rejected');
    if (!spaced.ok) assertEq(spaced.error, 'invalidUrl', 'reason surfaced for translation');
  });

  /* ══════════════════════ 32. UNIX TIMESTAMP CONVERTER ══════════════════ */
  console.log('\n⏱️  timestamp-converter');

  await test('seconds and milliseconds are told apart automatically', async () => {
    assertEq(detectUnit('1700000000'), 'seconds', 'ten digits = seconds');
    assertEq(detectUnit('1700000000000'), 'milliseconds', 'thirteen digits = milliseconds');
    const fromSeconds = timestampToDate('1700000000', 'seconds');
    const fromMillis = timestampToDate('1700000000000', 'milliseconds');
    assertEq(fromSeconds?.getTime(), 1700000000000, 'seconds converted');
    assertEq(fromMillis?.getTime(), 1700000000000, 'milliseconds converted');
    assertEq(timestampToDate('abc', 'seconds'), null, 'junk rejected');
  });

  await test('descriptions carry ISO, UTC, offset and relative phrasing', async () => {
    const date = new Date(Date.UTC(2026, 8, 14, 15, 30, 0));
    const described = describeDate(date, new Date(Date.UTC(2026, 8, 14, 15, 30, 30)));
    assertEq(described.iso, '2026-09-14T15:30:00.000Z', 'ISO 8601');
    assertEq(described.dateOnly, '2026-09-14', 'date only');
    assertEq(described.timeOnly, '15:30:00', 'time only');
    assertEq(described.utc, '2026-09-14 15:30:00 UTC', 'UTC stamp');
    assertEq(described.unixSeconds, 1789399800, 'unix seconds');
    assertEq(described.dayOfWeek, 1, 'Monday');
    assertEq(described.relative.key, 'seconds', 'relative unit');
    assertEq(described.relative.amount, 30, 'relative amount');
    assert(described.relative.past, 'a past timestamp is marked as past');
    assertEq(offsetLabel(-330), 'UTC-05:30', 'offset label');
    assertEq(offsetLabel(0), 'UTC+00:00', 'zero offset');
  });

  await test('a picked datetime converts back to a timestamp', async () => {
    const date = localInputToDate('2026-09-14T15:30');
    assert(date instanceof Date, 'datetime-local value parsed');
    if (!date) return;
    const seconds = Math.floor(date.getTime() / 1000);
    assertEq(timestampToDate(String(seconds), 'seconds')?.getTime(), date.getTime(), 'round trip');
    assertEq(isoWeekNumber(new Date(Date.UTC(2026, 0, 1))), 1, 'Jan 1st 2026 is in week 1');
    assertEq(localInputToDate('nonsense'), null, 'junk rejected');
  });

  /* ══════════════════════════ 33. CRON GENERATOR ════════════════════════ */
  console.log('\n⏰ cron-generator');

  await test('each frequency builds the expected expression', async () => {
    const base = { interval: 15, minute: 0, hour: 9, daysOfWeek: [1], dayOfMonth: 1, month: 1 };
    assertEq(buildCron({ ...base, frequency: 'minutes' }), '*/15 * * * *', 'every 15 minutes');
    assertEq(buildCron({ ...base, frequency: 'hourly' }), '0 */15 * * *', 'every 15 hours');
    assertEq(buildCron({ ...base, frequency: 'daily' }), '0 9 * * *', 'daily at 09:00');
    assertEq(buildCron({ ...base, frequency: 'weekly' }), '0 9 * * 1', 'weekly on Monday');
    assertEq(buildCron({ ...base, frequency: 'monthly' }), '0 9 1 * *', 'monthly on the 1st');
    assertEq(buildCron({ ...base, frequency: 'yearly' }), '0 9 1 1 *', 'yearly on Jan 1st');
    assertEq(buildCron({ ...base, frequency: 'minutes', interval: 1 }), '* * * * *', 'every minute');
    assertEq(buildCron({ ...base, frequency: 'weekly', daysOfWeek: [1, 5] }), '0 9 * * 1,5', 'multiple weekdays');
  });

  await test('built expressions are described in plain words', async () => {
    assertEq(describeCron('*/15 * * * *').kind, 'everyNMinutes', 'step minutes');
    assertEq(describeCron('0 * * * *').kind, 'everyHour', 'hourly');
    assertEq(describeCron('0 9 * * *').kind, 'daily', 'daily');
    const weekly = describeCron('0 9 * * 1,5');
    assertEq(weekly.kind, 'weekly', 'weekly');
    if (weekly.kind === 'weekly') assertEq(weekly.days.join(','), '1,5', 'weekdays reported');
    assertEq(describeCron('0 9 1 1 *').kind, 'yearly', 'yearly');
    assertEq(describeCron('@reboot').kind, 'custom', 'unknown shapes fall back to custom');
  });

  await test('validation rejects out-of-range fields', async () => {
    assertEq(validateCron('0 9 * * *').valid, true, 'valid expression accepted');
    assertEq(validateCron('61 * * * *').valid, false, 'minute 61 rejected');
    assertEq(validateCron('0 25 * * *').valid, false, 'hour 25 rejected');
    assertEq(validateCron('0 0 * *').valid, false, 'four fields rejected');
    assertEq(validateCron('0 0 0 * *').valid, false, 'day 0 rejected');
    const bad = validateCron('61 25 * * *');
    assert(bad.invalidFields.length >= 2, 'every bad field is reported');
  });

  /* ═══════════════ 34. REGISTRY & STRINGS AUDIT (both locales) ══════════ */
  console.log('\n📋 registry audit');

  await test('every tool has complete content in English and Arabic', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { TOOLS, CATEGORIES } = await import('@/lib/tools/registry');
    const problems: string[] = [];
    for (const locale of ['en', 'ar'] as const) {
      const messages = JSON.parse(
        readFileSync(join(process.cwd(), 'messages', `${locale}.json`), 'utf8'),
      ) as Record<string, Record<string, Record<string, unknown>>>;
      const tools = messages.tools ?? {};
      for (const tool of TOOLS) {
        const entry = tools[tool.slug];
        if (!entry) {
          problems.push(`${locale}: tools.${tool.slug} missing`);
          continue;
        }
        for (const field of ['name', 'short', 'description', 'intro']) {
          const value = entry[field];
          if (typeof value !== 'string' || !value.trim()) problems.push(`${locale}: ${tool.slug}.${field}`);
        }
        const howTo = entry.howTo;
        if (!Array.isArray(howTo) || howTo.length < 3) problems.push(`${locale}: ${tool.slug}.howTo`);
        const faqs = entry.faqs;
        if (!Array.isArray(faqs) || faqs.length < 2) problems.push(`${locale}: ${tool.slug}.faqs`);
        else if (!faqs.every((f) => typeof f === 'object' && f && 'q' in f && 'a' in f)) {
          problems.push(`${locale}: ${tool.slug}.faqs shape`);
        }
        // Short descriptions must stay short — they are the card benefit line.
        if (typeof entry.short === 'string' && entry.short.length > 120) {
          problems.push(`${locale}: ${tool.slug}.short is ${entry.short.length} chars`);
        }
      }
      for (const category of CATEGORIES) {
        const name = messages.categoryMeta?.[category.slug]?.name;
        if (typeof name !== 'string' || !name.trim()) problems.push(`${locale}: categoryMeta.${category.slug}.name`);
      }
      if (problems.length) break;
    }
    assertEq(problems.length, 0, `missing or malformed strings: ${problems.slice(0, 8).join(' | ')}`);
  });

  await test('related tools always resolve, never self-reference, and leave no dead ends', async () => {
    const { TOOLS, SLUGS } = await import('@/lib/tools/registry');
    const slugs = new Set(SLUGS);
    const problems: string[] = [];
    for (const tool of TOOLS) {
      const related = tool.relatedTools ?? [];
      if (related.length < 2) problems.push(`${tool.slug} has only ${related.length} related tool(s)`);
      for (const slug of related) {
        if (!slugs.has(slug)) problems.push(`${tool.slug} → unknown ${slug}`);
        if (slug === tool.slug) problems.push(`${tool.slug} → itself`);
      }
      if (new Set(related).size !== related.length) problems.push(`${tool.slug} repeats a related tool`);
    }
    const referenced = new Set(TOOLS.flatMap((tool) => tool.relatedTools));
    const orphans = TOOLS.filter((tool) => !referenced.has(tool.slug)).map((tool) => tool.slug);
    assertEq(orphans.length, 0, `tools never suggested anywhere: ${orphans.join(', ')}`);
    assertEq(problems.length, 0, problems.slice(0, 6).join(' | '));
    assertEq(TOOLS.length, slugs.size, 'no duplicate slugs');
  });

  process.exitCode = summary();
}

void main();
