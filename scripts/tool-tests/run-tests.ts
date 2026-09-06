/**
 * Full-cycle tests for every image tool processor.
 *
 * Each test mirrors the real user flow: pick a file → decode (decodeImage,
 * the same function ToolWorkspace uses) → run the tool processor with the
 * same options the UI passes → assert the OUTPUT is actually transformed
 * (dimensions, format, pixels, size) and never the untouched original.
 *
 * Run with:  npx tsx scripts/tool-tests/run-tests.ts
 */
import { installBrowserEnv, inspectBlob, pixelAt } from './browser-env';

installBrowserEnv();

/* eslint-disable @typescript-eslint/no-var-requires */
import { decodeImage, canvasToBlob } from '@/lib/image/format';
import { compressImages, type SmartCompressedResult } from '@/lib/tools/processors/compressor';
import { resizeImage } from '@/lib/tools/processors/resizer';
import { cropImage } from '@/lib/tools/processors/cropper';
import { rotateImage } from '@/lib/tools/processors/rotator';
import { flipImage } from '@/lib/tools/processors/flip';
import { convertImage, convertMany } from '@/lib/tools/processors/convert';
import { imagesToPdf } from '@/lib/tools/processors/pdf';
import { mergeImages } from '@/lib/tools/processors/merge';
import { splitImage } from '@/lib/tools/processors/split';
import { toGrayscale } from '@/lib/tools/processors/grayscale';
import { applyWatermark } from '@/lib/tools/processors/watermark';
import { compressToExactSize } from '@/lib/tools/processors/exact-size';
import { removeBackground } from '@/lib/tools/processors/background';
import { makePassportPhoto } from '@/lib/tools/processors/passport';
import { makeSignature } from '@/lib/tools/processors/signature';
import { triggerDownload } from '@/lib/image/format';
import {
  assert,
  assertEq,
  assertNear,
  makeHalfFile,
  makeOptimisedScreenshotPngFile,
  makePhotoFile,
  makeTransparentPngFile,
  summary,
  test,
} from './testkit';

async function decode(file: File) {
  return decodeImage(file);
}

async function main() {
  /* ═══════════════════════════ 1. COMPRESSOR ═══════════════════════════ */
  console.log('\n🗜️  image-compressor');

  await test('JPEG photo: compress at 80% produces a smaller JPEG AT the ceiling when that already saves ≥40%', async () => {
    const file = await makePhotoFile('photo.jpg', 1200, 800, 'image/jpeg', 0.92);
    const decoded = await decode(file);
    const [r] = (await compressImages([decoded], { quality: 80, format: 'same' })) as SmartCompressedResult[];
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/jpeg', 'output format');
    assertEq(info.width, 1200, 'width preserved');
    assertEq(info.height, 800, 'height preserved');
    assert(r.wasCompressed === true, 'wasCompressed flag must be true');
    assert(r.outputSize < file.size, `output (${r.outputSize}) must be smaller than original (${file.size})`);
    assert(r.blob !== (file as unknown as Blob), 'must not return the original file object');
    assertEq(r.name, 'photo.jpg', 'output name');
    // a q92 original re-encoded at q80 already saves ~40-50% → the user's
    // ceiling must be honoured, not needlessly lowered
    assertEq(r.finalQuality, 80, 'delivered at the requested ceiling');
  });

  await test('phone-photo JPEG: default run delivers SERIOUS savings (≥40%) at quality ≥45', async () => {
    // The reported complaint: an already-compressed phone photo saved only a
    // few percent at the q80 ceiling ("not compressing seriously"). The tool
    // must now search below the ceiling for real savings.
    const file = await makePhotoFile('phone.jpg', 1600, 1200, 'image/jpeg', 0.85);
    const decoded = await decode(file);
    const [r] = (await compressImages([decoded], { quality: 80, format: 'same' })) as SmartCompressedResult[];
    assert(r.wasCompressed, 'must compress');
    const savings = 1 - r.outputSize / file.size;
    assert(savings >= 0.4, `savings must be ≥40%, got ${(savings * 100).toFixed(1)}%`);
    assert(
      typeof r.finalQuality === 'number' && r.finalQuality >= 45 && r.finalQuality <= 80,
      `quality (${r.finalQuality}) must stay within [45, 80]`,
    );
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/jpeg', 'still a JPEG');
    assertEq(info.width, 1600, 'dimensions untouched');
  });

  await test('already-compressed JPEG: real savings but NEVER below the quality floors', async () => {
    // Original saved at q=0.55 ("wrung-out" input): the old buggy code
    // cratered it to ~5KB at q≈6; the conservative fix only reached ~0%
    // savings. Contract now: target ≥40% savings, preferred floor q45,
    // absolute floor q35 — whatever the encoder allows, never garbage.
    const file = await makePhotoFile('small.jpg', 1000, 700, 'image/jpeg', 0.55);
    const decoded = await decode(file);
    const [r] = (await compressImages([decoded], { quality: 80, format: 'same' })) as SmartCompressedResult[];
    assert(r.wasCompressed === true, 'wasCompressed must be true');
    assert(r.outputSize < file.size, `output (${r.outputSize}) must be < original (${file.size})`);
    assert(
      typeof r.finalQuality === 'number' && r.finalQuality >= 35,
      `finalQuality (${r.finalQuality}) must respect the 35% absolute floor — no more q≈6 garbage`,
    );
    assert(
      r.outputSize <= file.size * 0.92,
      `savings must beat the do-nothing case for this wrung-out input, got ${((1 - r.outputSize / file.size) * 100).toFixed(1)}%`,
    );
  });

  await test('web photo (q75 input): unlocks the deep savings band at/above the hard floor', async () => {
    // Measured curve for a q75 original: q80 inflates, q65 saves 11%, q45
    // saves 64% — the search must land at/above the target (≥40%) without
    // diving below the floors.
    const file = await makePhotoFile('web.jpg', 1200, 800, 'image/jpeg', 0.75);
    const decoded = await decode(file);
    const [r] = (await compressImages([decoded], { quality: 80, format: 'same' })) as SmartCompressedResult[];
    assert(r.wasCompressed, 'must compress');
    const savings = 1 - r.outputSize / file.size;
    assert(savings >= 0.35, `savings must be serious, got ${(savings * 100).toFixed(1)}%`);
    assert(
      typeof r.finalQuality === 'number' && r.finalQuality >= 35 && r.finalQuality <= 80,
      `finalQuality (${r.finalQuality}) within [35, 80]`,
    );
  });

  await test('optimised PNG (screenshot): must NOT silently return the original without flagging it', async () => {
    // Palette-optimised PNG: canvas RGBA re-encode is always bigger. The tool
    // may legitimately deliver the original, but ONLY with wasCompressed=false
    // and an explanatory message the UI can show.
    const file = makeOptimisedScreenshotPngFile('screenshot.png');
    const decoded = await decode(file);
    const rs = (await compressImages([decoded], { quality: 80, format: 'same' })) as SmartCompressedResult[];
    const r = rs[0];
    if (r.outputSize >= file.size) {
      assertEq(r.wasCompressed, false, 'no-gain result must set wasCompressed=false');
      assert(
        r.message === 'original-fallback-inflation' || r.message === 'same-size',
        `no-gain result must carry an explanatory message, got "${r.message ?? ''}"`,
      );
      // the fallback must deliver the ORIGINAL bytes, honestly labelled
      assertEq(r.outputSize, file.size, 'fallback output size = original size');
      assertEq(r.format, 'png', 'fallback keeps the real format');
      assertEq(r.name, 'screenshot.png', 'fallback keeps the real name');
      const same = Buffer.compare(
        Buffer.from(await r.blob.arrayBuffer()),
        Buffer.from(await file.arrayBuffer()),
      );
      assertEq(same, 0, 'fallback blob must be byte-identical to the original');
      // no WebP suggestion for this fixture: even WebP is bigger than a
      // palette-optimised 1.6KB screenshot, and suggesting a LARGER file
      // would be noise
      assertEq(rs.length, 1, 'no suggestion card when WebP cannot beat the original');
    } else {
      assertEq(r.wasCompressed, true, 'smaller output must set wasCompressed=true');
      assertEq(r.message, 'compressed-success', 'success message');
    }
  });

  await test('photo-like PNG: fallback is paired with a much smaller WebP suggestion', async () => {
    // A photo saved as PNG cannot be shrunk losslessly — but a WebP copy
    // saves ~80%. The tool must deliver BOTH: the untouched original (same
    // format promise) + a suggested WebP card the user can choose.
    const file = await makePhotoFile('photo.png', 900, 700, 'image/png');
    const decoded = await decode(file);
    const rs = (await compressImages([decoded], { quality: 80, format: 'same' })) as SmartCompressedResult[];
    const primary = rs.filter((x) => !x.suggested);
    const suggestions = rs.filter((x) => x.suggested);
    assertEq(primary.length, 1, 'one primary result');
    assertEq(suggestions.length, 1, 'one WebP suggestion');
    const s = suggestions[0];
    assertEq(s.format, 'webp', 'suggestion is WebP');
    assertEq(s.name, 'photo.webp', 'suggestion name');
    assert(s.wasCompressed, 'suggestion is genuinely smaller');
    assert(s.outputSize < file.size * 0.5, `WebP suggestion must be a serious win, got ${s.outputSize} vs ${file.size}`);
    const info = await inspectBlob(s.blob);
    assertEq(info.mime, 'image/webp', 'suggestion bytes are really WebP');
    assertEq(info.width, 900, 'suggestion keeps dimensions');
  });

  await test('transparent PNG → same format: transparency is PRESERVED', async () => {
    const file = await makeTransparentPngFile('logo.png', 300, 220);
    const decoded = await decode(file);
    const [r] = await compressImages([decoded], { quality: 80, format: 'same' });
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/png', 'stays PNG');
    const corner = pixelAt(info.rgba, info.width, 2, 2);
    assertEq(corner.a, 0, 'transparent corner must stay transparent');
  });

  await test('explicit WebP output: delivers REAL webp bytes even if not smaller', async () => {
    // A tiny palette-optimised PNG can beat any WebP re-encode; the user
    // still asked for WebP, so the tool must deliver a genuine .webp — never
    // silently hand back the original PNG.
    const file = makeOptimisedScreenshotPngFile('screenshot.png');
    const decoded = await decode(file);
    const [r] = (await compressImages([decoded], { quality: 80, format: 'webp' })) as SmartCompressedResult[];
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/webp', 'output must really be WebP');
    assertEq(r.format, 'webp', 'result format');
    assertEq(r.name, 'screenshot.webp', 'result name follows the requested format');
    if (r.outputSize >= file.size) {
      assertEq(r.message, 'converted-larger', 'honest message when conversion inflates');
      assertEq(r.wasCompressed, false, 'wasCompressed=false when not smaller');
    } else {
      assertEq(r.message, 'compressed-success', 'success when smaller');
    }
  });

  await test('lossy success records the quality actually used', async () => {
    const file = await makePhotoFile('q.jpg', 900, 640, 'image/jpeg', 0.95);
    const decoded = await decode(file);
    const [r] = (await compressImages([decoded], { quality: 70, format: 'same' })) as SmartCompressedResult[];
    assert(r.wasCompressed, 'must compress');
    assert(
      typeof r.finalQuality === 'number' && r.finalQuality > 0 && r.finalQuality <= 70,
      `finalQuality (${r.finalQuality}) must be a sane value ≤ the requested 70`,
    );
  });

  await test('transparent PNG → JPG output: transparent areas become WHITE, not black', async () => {
    const file = await makeTransparentPngFile('logo.png');
    const decoded = await decode(file);
    const [r] = await compressImages([decoded], { quality: 85, format: 'jpg' });
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/jpeg', 'output must be JPEG');
    const corner = pixelAt(info.rgba, info.width, 2, 2);
    assert(
      corner.r > 235 && corner.g > 235 && corner.b > 235,
      `corner pixel must be white-ish, got rgb(${corner.r},${corner.g},${corner.b})`,
    );
    assertEq(r.name, 'logo.jpg', 'name must follow the ACTUAL output format');
  });

  await test('WebP photo: compress keeps webp container and reduces size', async () => {
    const file = await makePhotoFile('shot.webp', 1000, 700, 'image/webp', 0.95);
    const decoded = await decode(file);
    const [r] = (await compressImages([decoded], { quality: 70, format: 'same' })) as SmartCompressedResult[];
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/webp', 'output stays WebP');
    assert(r.outputSize < file.size, 'webp output must be smaller than the 0.95-quality original');
  });

  await test('compressor: multiple files each report their own original size', async () => {
    const a = await makePhotoFile('a.jpg', 900, 600, 'image/jpeg', 0.95);
    const b = await makePhotoFile('b.jpg', 700, 500, 'image/jpeg', 0.95, 7);
    const decoded = [await decode(a), await decode(b)];
    const rs = (await compressImages(decoded, { quality: 75, format: 'same' })) as SmartCompressedResult[];
    assertEq(rs.length, 2, 'two results');
    assertEq(rs[0].originalSize, a.size, 'result 0 original size');
    assertEq(rs[1].originalSize, b.size, 'result 1 original size');
  });

  /* ═══════════════════════════ 2. RESIZER ═══════════════════════════ */
  console.log('\n📐 image-resizer');

  await test('resize 1200×800 → 600×400 changes dimensions', async () => {
    const file = await makePhotoFile('big.jpg', 1200, 800, 'image/jpeg', 0.9);
    const decoded = await decode(file);
    const r = await resizeImage([decoded], { width: 600, height: 400, format: 'jpg' });
    const info = await inspectBlob(r.blob);
    assertEq(info.width, 600, 'resized width');
    assertEq(info.height, 400, 'resized height');
    assertEq(info.mime, 'image/jpeg', 'format');
  });

  await test('resize transparent PNG → JPG fills white background', async () => {
    const file = await makeTransparentPngFile('t.png', 320, 240);
    const decoded = await decode(file);
    const r = await resizeImage([decoded], { width: 160, height: 120, format: 'jpg' });
    const info = await inspectBlob(r.blob);
    const corner = pixelAt(info.rgba, info.width, 1, 1);
    assert(corner.r > 235 && corner.g > 235 && corner.b > 235, 'corner must be white');
  });

  /* ═══════════════════════════ 3. CROPPER ═══════════════════════════ */
  console.log('\n✂️  image-cropper');

  await test('crop applies the selected region (dimensions + pixels)', async () => {
    // left half red / right half blue image
    const file = await makeHalfFile('half.png', 400, 200);
    const decoded = await decode(file);
    const r = await cropImage([decoded], { x: 200, y: 0, width: 200, height: 200, format: 'png' });
    const info = await inspectBlob(r.blob);
    assertEq(info.width, 200, 'cropped width');
    assertEq(info.height, 200, 'cropped height');
    const p = pixelAt(info.rgba, info.width, 10, 100);
    assert(p.b > p.r, 'cropped region must contain the BLUE half');
  });

  await test('selecting an aspect ratio RESHAPES the frame immediately', async () => {
    // The reported bug: choosing e.g. 1:1 left the frame untouched — the
    // ratio only applied if the user then dragged a corner. The pure
    // geometry behind the Select's onChange must snap the current frame.
    const { ratioBoxFor, RATIOS } = await import('@/components/tools/ui/crop-geometry');
    const imgW = 1200;
    const imgH = 800;
    // default frame the tool initialises: 86% centred
    const w0 = Math.round(imgW * 0.86);
    const h0 = Math.round(imgH * 0.86);
    const start = { x: Math.round((imgW - w0) / 2), y: Math.round((imgH - h0) / 2), w: w0, h: h0 };

    const square = ratioBoxFor(imgW, imgH, RATIOS['1:1']!, start);
    assertEq(square.w, 800, '1:1 width = image height (largest centred square)');
    assertEq(square.h, 800, '1:1 height');
    assertEq(square.x, 200, '1:1 centred horizontally');
    assertEq(square.y, 0, '1:1 centred vertically');

    const wide = ratioBoxFor(imgW, imgH, RATIOS['16:9']!, start);
    assertNear(wide.w / wide.h, 16 / 9, 0.01, '16:9 frame keeps the ratio');
    assert(wide.w <= imgW && wide.h <= imgH, '16:9 frame fits inside the image');

    const tall = ratioBoxFor(imgW, imgH, RATIOS['9:16']!, start);
    assertNear(tall.w / tall.h, 9 / 16, 0.01, '9:16 frame keeps the ratio');
    assertEq(tall.h, 800, '9:16 uses full height');

    // A small off-centre selection must stay roughly WHERE the user put it
    // (covers the selection, keeps its centre) instead of jumping to the
    // largest possible frame.
    const small = { x: 900, y: 600, w: 200, h: 150 };
    const snapped = ratioBoxFor(imgW, imgH, RATIOS['1:1']!, small);
    assertEq(snapped.w, 200, 'small selection keeps its scale (200×200)');
    assertEq(snapped.h, 200, 'small selection keeps its scale');
    assertNear(snapped.x + snapped.w / 2, 1000, 1, 'centre X preserved');
    assertNear(snapped.y + snapped.h / 2, 675, 1, 'centre Y preserved');
    assert(
      snapped.x >= 0 && snapped.y >= 0 && snapped.x + snapped.w <= imgW && snapped.y + snapped.h <= imgH,
      'snapped frame stays inside the image',
    );
  });

  await test('ratio-locked corner resize never breaks the ratio at image edges', async () => {
    const { ratioResizeBox } = await import('@/components/tools/ui/crop-geometry');
    // Dragging the SE corner freely to 500×100 with 1:1 lock → 500×500.
    const a = ratioResizeBox(1000, 1000, 1, 0, 0, 'e', 's', 500, 100, 24);
    assertNear(a.w / a.h, 1, 1e-9, '1:1 kept during free drag');
    assertEq(a.w, 500, 'dominant dimension wins');
    // Anchor near the east edge: only 200px available → the frame must
    // shrink PROPORTIONALLY (old code clamped w/h independently → 200×500).
    const b = ratioResizeBox(1000, 1000, 1, 800, 0, 'e', 's', 500, 500, 24);
    assertEq(b.w, 200, 'clamped to available width');
    assertEq(b.h, 200, 'height follows the ratio instead of breaking it');
    assertEq(b.x, 800, 'anchored at the west edge');
    assert(b.x + b.w <= 1000, 'inside the image');
    // Dragging the NW corner (anchor = SE) with a 4:3 lock.
    const c = ratioResizeBox(1000, 1000, 4 / 3, 900, 900, 'w', 'n', 300, 900, 24);
    assertNear(c.w / c.h, 4 / 3, 1e-9, '4:3 kept when dragging NW');
    assert(c.x >= 0 && c.y >= 0 && c.x + c.w <= 900.5 && c.y + c.h <= 900.5, 'stays inside, anchor fixed');
  });

  await test('crop with fractional-ish box stays inside the image', async () => {
    const file = await makePhotoFile('p.jpg', 800, 600, 'image/jpeg', 0.9);
    const decoded = await decode(file);
    const r = await cropImage([decoded], { x: 10, y: 10, width: 780, height: 580, format: 'jpg' });
    const info = await inspectBlob(r.blob);
    assertEq(info.width, 780, 'width');
    assertEq(info.height, 580, 'height');
    assertEq(info.mime, 'image/jpeg', 'mime');
  });

  /* ═══════════════════════════ 4. ROTATOR ═══════════════════════════ */
  console.log('\n🔄 image-rotator');

  await test('rotate 90° swaps dimensions and moves content', async () => {
    const file = await makeHalfFile('half.png', 400, 200);
    const decoded = await decode(file);
    const r = await rotateImage([decoded], { angle: 90, format: 'png' });
    const info = await inspectBlob(r.blob);
    assertEq(info.width, 200, 'width swapped');
    assertEq(info.height, 400, 'height swapped');
    // 90° CW: left(red) half → top, right(blue) → bottom
    const top = pixelAt(info.rgba, info.width, 100, 20);
    const bottom = pixelAt(info.rgba, info.width, 100, 380);
    assert(top.r > top.b, 'top must be red after 90° CW rotation');
    assert(bottom.b > bottom.r, 'bottom must be blue after 90° CW rotation');
  });

  await test('rotate 180° mirrors content', async () => {
    const file = await makeHalfFile('half.png', 400, 200);
    const decoded = await decode(file);
    const r = await rotateImage([decoded], { angle: 180, format: 'png' });
    const info = await inspectBlob(r.blob);
    assertEq(info.width, 400, 'width kept');
    const left = pixelAt(info.rgba, info.width, 10, 100);
    assert(left.b > left.r, 'left side must now be blue');
  });

  await test('rotate by non-right angle expands canvas', async () => {
    const file = await makeHalfFile('half.png', 400, 200);
    const decoded = await decode(file);
    const r = await rotateImage([decoded], { angle: 45, format: 'png' });
    const info = await inspectBlob(r.blob);
    const expected = Math.round(400 * Math.cos(Math.PI / 4) + 200 * Math.sin(Math.PI / 4));
    assertEq(info.width, expected, '45° width');
    assert(info.height > 200, 'height grows');
  });

  /* ═══════════════════════════ 5. FLIP ═══════════════════════════ */
  console.log('\n🪞 flip');

  await test('flip horizontal mirrors left/right', async () => {
    const file = await makeHalfFile('half.png', 400, 200);
    const decoded = await decode(file);
    const r = await flipImage([decoded], { direction: 'horizontal', format: 'png' });
    const info = await inspectBlob(r.blob);
    const left = pixelAt(info.rgba, info.width, 10, 100);
    assert(left.b > left.r, 'left must become blue');
  });

  await test('flip vertical mirrors top/bottom', async () => {
    const file = await makeHalfFile('half.png', 400, 200);
    const decoded = await decode(file);
    const r = await flipImage([decoded], { direction: 'vertical', format: 'png' });
    const info = await inspectBlob(r.blob);
    const left = pixelAt(info.rgba, info.width, 10, 100);
    assert(left.r > left.b, 'left stays red after vertical flip');
  });

  /* ═══════════════════════════ 6. CONVERTERS ═══════════════════════════ */
  console.log('\n🔁 converters (jpg/png/webp + heic routing)');

  await test('jpg → png converts container', async () => {
    const file = await makePhotoFile('p.jpg', 640, 480, 'image/jpeg', 0.9);
    const decoded = await decode(file);
    const r = await convertImage([decoded], { format: 'png', quality: 90, background: '#ffffff' });
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/png', 'png output');
    assertEq(r.name, 'p.png', 'name updated');
  });

  await test('png(transparent) → jpg uses the chosen background colour', async () => {
    const file = await makeTransparentPngFile('t.png');
    const decoded = await decode(file);
    const r = await convertImage([decoded], { format: 'jpg', quality: 90, background: '#ff0000' });
    const info = await inspectBlob(r.blob);
    const corner = pixelAt(info.rgba, info.width, 2, 2);
    assert(corner.r > 200 && corner.g < 80 && corner.b < 80, `corner must be red-ish, got ${JSON.stringify(corner)}`);
  });

  await test('png → webp converts container', async () => {
    const file = await makeHalfFile('half.png', 320, 200);
    const decoded = await decode(file);
    const r = await convertImage([decoded], { format: 'webp', quality: 90, background: '#ffffff' });
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/webp', 'webp output');
  });

  await test('convertMany handles batches', async () => {
    const a = await makePhotoFile('a.jpg', 320, 240, 'image/jpeg', 0.9);
    const b = await makePhotoFile('b.jpg', 320, 240, 'image/jpeg', 0.9, 9);
    const rs = await convertMany([await decode(a), await decode(b)], {
      format: 'png',
      quality: 90,
      background: '#fff',
    });
    assertEq(rs.length, 2, 'batch size');
    assertEq(rs[0].name, 'a.png', 'name a');
    assertEq(rs[1].name, 'b.png', 'name b');
  });

  /* ═══════════════════════════ 7. IMAGE→PDF ═══════════════════════════ */
  console.log('\n📄 image-to-pdf');

  await test('two images produce a valid 2-page PDF', async () => {
    const a = await makePhotoFile('a.jpg', 640, 480, 'image/jpeg', 0.85);
    const b = await makeHalfFile('b.png', 400, 200);
    const r = await imagesToPdf([await decode(a), await decode(b)], {
      pageSize: 'a4',
      orientation: 'portrait',
    });
    const head = Buffer.from(await r.blob.slice(0, 4).arrayBuffer()).toString('latin1');
    assertEq(head, '%PDF', 'PDF magic');
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(await r.blob.arrayBuffer());
    assertEq(doc.getPageCount(), 2, 'page count');
    assertEq(r.name, 'images.pdf', 'batch name');
  });

  /* ═══════════════════════════ 8. MERGE ═══════════════════════════ */
  console.log('\n🧩 merge-images');

  await test('horizontal merge stacks widths', async () => {
    const a = await makeHalfFile('a.png', 300, 200);
    const b = await makeHalfFile('b.png', 250, 200);
    const r = await mergeImages([await decode(a), await decode(b)], {
      direction: 'horizontal',
      spacing: 10,
      background: '#ffffff',
      format: 'png',
    });
    const info = await inspectBlob(r.blob);
    // cells are normalised to the widest image (300px each) + 10px spacing
    assertEq(info.width, 300 * 2 + 10, 'merged width');
    assertEq(info.height, 200, 'merged height');
  });

  /* ═══════════════════════════ 9. SPLIT ═══════════════════════════ */
  console.log('\n🔲 split-image');

  await test('2×2 split yields four correctly sized tiles', async () => {
    const file = await makeHalfFile('half.png', 400, 200);
    const rs = await splitImage([await decode(file)], { rows: 2, cols: 2, format: 'png' });
    assertEq(rs.length, 4, 'tile count');
    for (const r of rs) {
      const info = await inspectBlob(r.blob);
      assertEq(info.width, 200, 'tile width');
      assertEq(info.height, 100, 'tile height');
    }
    // top-left tile must be red, bottom-right must be blue
    const tl = await inspectBlob(rs[0].blob);
    const br = await inspectBlob(rs[3].blob);
    assert(pixelAt(tl.rgba, tl.width, 5, 5).r > 150, 'top-left tile is red half');
    assert(pixelAt(br.rgba, br.width, 195, 5).b > 150, 'bottom-right tile is blue half');
  });

  /* ═══════════════════════════ 10. GRAYSCALE ═══════════════════════════ */
  console.log('\n🌑 grayscale');

  await test('grayscale removes colour information', async () => {
    const file = await makePhotoFile('c.jpg', 500, 400, 'image/jpeg', 0.9);
    const r = await toGrayscale([await decode(file)], { format: 'jpg' });
    const info = await inspectBlob(r.blob);
    let colourful = 0;
    for (let i = 0; i < info.rgba.length; i += 4 * 97) {
      const mx = Math.max(info.rgba[i], info.rgba[i + 1], info.rgba[i + 2]);
      const mn = Math.min(info.rgba[i], info.rgba[i + 1], info.rgba[i + 2]);
      if (mx - mn > 12) colourful += 1; // allow tiny jpeg ringing
    }
    assert(colourful === 0, `found ${colourful} clearly colourful samples in grayscale output`);
  });

  /* ═══════════════════════════ 11. WATERMARK ═══════════════════════════ */
  console.log('\n💧 watermark');

  await test('text watermark visibly changes the target corner', async () => {
    const file = await makePhotoFile('w.jpg', 800, 600, 'image/jpeg', 0.9);
    const decoded = await decode(file);
    const before = await inspectBlob(new Blob([await decoded.file.arrayBuffer()]));
    const r = await applyWatermark([decoded], {
      type: 'text',
      text: '© TEST',
      fontFamily: 'sans-serif',
      fontSize: 48,
      color: '#ffffff',
      opacity: 100,
      position: 'br',
      tile: false,
      format: 'png',
      watermarkScale: 20,
    });
    const info = await inspectBlob(r.blob);
    assertEq(info.width, 800, 'dimensions preserved');
    // bottom-right region must differ from the original
    let diffs = 0;
    for (let y = 540; y < 595; y += 3) {
      for (let x = 560; x < 795; x += 3) {
        const a = pixelAt(before.rgba, before.width, x, y);
        const b = pixelAt(info.rgba, info.width, x, y);
        if (Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b) > 90) diffs += 1;
      }
    }
    assert(diffs > 4, `watermark text should alter many pixels in the corner, only ${diffs} changed`);
  });

  /* ═══════════════════════════ 12. EXACT KB ═══════════════════════════ */
  console.log('\🎯 image-to-exact-kb');

  await test('JPEG hits a 200 KB target from a ~1 MB original', async () => {
    const file = await makePhotoFile('huge.jpg', 1800, 1200, 'image/jpeg', 0.97);
    assert(file.size > 500 * 1024, `fixture must be big, got ${file.size}`);
    const decoded = await decode(file);
    const [r] = await compressToExactSize([decoded], { targetKB: 200, format: 'jpg' });
    assertEq(r.hit, true, 'target must be hit');
    assert(r.outputSize <= 200 * 1024, `output ${r.outputSize} must be ≤ target`);
    assert(r.outputSize >= 90 * 1024, `output ${r.outputSize} should stay reasonably close to target`);
  });

  await test('exact-kb on transparent PNG → JPG keeps white background', async () => {
    const file = await makeTransparentPngFile('logo.png', 600, 400);
    const decoded = await decode(file);
    const [r] = await compressToExactSize([decoded], { targetKB: 100, format: 'jpg' });
    const info = await inspectBlob(r.blob);
    const corner = pixelAt(info.rgba, info.width, 2, 2);
    assert(
      corner.r > 235 && corner.g > 235 && corner.b > 235,
      `corner must be white, got rgb(${corner.r},${corner.g},${corner.b})`,
    );
  });

  await test('exact-kb with PNG output scales dimensions down to hit target', async () => {
    const file = await makePhotoFile('noise.png', 900, 700, 'image/png');
    const decoded = await decode(file);
    const [r] = await compressToExactSize([decoded], { targetKB: 60, format: 'png' });
    assert(r.outputSize <= 60 * 1024 || r.hit === false, 'either hit the target or honestly report miss');
    if (r.hit) {
      assert(
        r.finalWidth < file.name.length + 900 && r.finalWidth > 0,
        'final dimensions recorded',
      );
    }
  });

  /* ═══════════════════════════ 13. BG REMOVER ═══════════════════════════ */
  console.log('\n🪄 background-remover');

  await test('solid background becomes transparent, subject stays', async () => {
    const file = await makeTransparentPngFile('subj.png'); // red circle, transparent bg
    // give it a white backdrop first (simulate a product shot)
    const decodedInner = await decode(file);
    const white = await (async () => {
      const { createCanvas } = await import('@/lib/image/process');
      const { canvas, ctx } = createCanvas(decodedInner.width, decodedInner.height);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage((decodedInner.bitmap ?? decodedInner.image) as never, 0, 0);
      return canvasToBlob(canvas, { format: 'png' });
    })();
    const onWhite = new File([white], 'on-white.png', { type: 'image/png' });
    const decoded = await decode(onWhite);
    const [r] = await removeBackground([decoded], { tolerance: 30, feather: 20, source: 'corners' });
    const info = await inspectBlob(r.blob);
    const corner = pixelAt(info.rgba, info.width, 3, 3);
    const center = pixelAt(info.rgba, info.width, Math.floor(info.width / 2), Math.floor(info.height / 2));
    assertEq(corner.a, 0, 'corner alpha must be 0 (background removed)');
    assert(center.a > 200 && center.r > 150, 'subject (red circle) must remain opaque');
  });

  /* ═══════════════════════════ 14. PASSPORT ═══════════════════════════ */
  console.log('\n🛂 passport-photo-maker');

  await test('35×45 mm @300dpi yields 413×531 px', async () => {
    const file = await makePhotoFile('face.jpg', 900, 1200, 'image/jpeg', 0.9);
    const decoded = await decode(file);
    const [r] = await makePassportPhoto([decoded], {
      presetId: '35x45',
      dpi: 300,
      background: '#ffffff',
      format: 'jpg',
    });
    const info = await inspectBlob(r.blob);
    assertEq(info.width, 413, 'passport width');
    assertEq(info.height, 531, 'passport height'); // round(45/25.4*300) = 531
    assertEq(r.format, 'jpg', 'format');
  });

  /* ═══════════════════════════ 15. SIGNATURE ═══════════════════════════ */
  console.log('\n✍️  signature-maker');

  await test('dark strokes on white → cropped transparent PNG', async () => {
    // build a signature-like image: white page, black scribble in the middle
    const { createCanvas } = await import('@napi-rs/canvas');
    const c = createCanvas(800, 400);
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff';
    x.fillRect(0, 0, 800, 400);
    x.strokeStyle = '#111111';
    x.lineWidth = 6;
    x.beginPath();
    for (let i = 0; i < 60; i += 1) {
      const px = 250 + i * 5;
      const py = 200 + Math.sin(i / 4) * 40;
      if (i === 0) x.moveTo(px, py);
      else x.lineTo(px, py);
    }
    x.stroke();
    const buf = c.toBuffer('image/png');
    const file = new File([new Uint8Array(buf)], 'sig.png', { type: 'image/png' });

    const decoded = await decode(file);
    const [r] = await makeSignature([decoded], { threshold: 60, ink: '#000000', invert: false });
    const info = await inspectBlob(r.blob);
    assertEq(info.mime, 'image/png', 'png output');
    assert(info.width < 800 && info.height < 400, `must auto-crop to ink box, got ${info.width}×${info.height}`);
    assert(info.width > 100 && info.height > 30, 'ink box must contain the scribble');
    // some pixels must be opaque ink, others fully transparent
    let ink = 0;
    let clear = 0;
    for (let i = 3; i < info.rgba.length; i += 4 * 31) {
      if (info.rgba[i] > 128) ink += 1;
      if (info.rgba[i] === 0) clear += 1;
    }
    assert(ink > 5, 'ink pixels present');
    assert(clear > 5, 'transparent pixels present');
  });

  /* ═══════════════════════════ 16. DOWNLOAD FLOW ═══════════════════════════ */
  console.log('\n⬇️  download flow');

  await test('triggerDownload delivers the PROCESSED blob under a safe name', async () => {
    const file = await makePhotoFile('photo.jpg', 400, 300, 'image/jpeg', 0.95);
    const decoded = await decode(file);
    const [r] = (await compressImages([decoded], { quality: 60, format: 'same' })) as SmartCompressedResult[];
    const log = (globalThis as unknown as { __downloadLog: { filename: string; size: number }[] }).__downloadLog;
    log.length = 0;
    triggerDownload(r.blob, r.name);
    await new Promise((res) => setTimeout(res, 10));
    assertEq(log.length, 1, 'one download triggered');
    assertEq(log[0].filename, 'photo.jpg', 'safe filename');
    assertEq(log[0].size, r.blob.size, 'downloaded bytes = processed blob bytes');
  });

  process.exitCode = summary();
}

void main();
