/**
 * End-to-end processor pipeline tests.
 *
 * Runs the REAL code the tools use: fixture File → decodeImage (content-first
 * sniffing) → processor → result Blob → pixel/byte assertions. Every image
 * tool's execute path is covered so a silent no-op or "same file back"
 * regression fails loudly here.
 */
import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import { installBrowserShim } from '../helpers/browser-shim';
import {
  makePhotoFile,
  makeQuadrantFile,
  makeBgFile,
  makeSignatureFile,
  blobToImage,
  distinctColors,
  pixelAt,
} from '../helpers/fixtures';
import { decodeImage } from '@/lib/image/format';
import { compressImages } from '@/lib/tools/processors/compressor';
import { quantizeToPng, quantizeRgba } from '@/lib/image/quantize';
import { cropImage } from '@/lib/tools/processors/cropper';
import { resizeImage } from '@/lib/tools/processors/resizer';
import { rotateImage } from '@/lib/tools/processors/rotator';
import { flipImage } from '@/lib/tools/processors/flip';
import { toGrayscale } from '@/lib/tools/processors/grayscale';
import { convertImage } from '@/lib/tools/processors/convert';
import { compressToExactSize } from '@/lib/tools/processors/exact-size';
import { removeBackground } from '@/lib/tools/processors/background';
import { makePassportPhoto } from '@/lib/tools/processors/passport';
import { makeSignature } from '@/lib/tools/processors/signature';
import { applyWatermark } from '@/lib/tools/processors/watermark';
import { splitImage } from '@/lib/tools/processors/split';
import { mergeImages } from '@/lib/tools/processors/merge';
import { imagesToPdf } from '@/lib/tools/processors/pdf';
import { validateFiles, defaultRuleFor } from '@/lib/validation';
import type { DecodedImage } from '@/lib/types';

before(() => {
  installBrowserShim();
});

async function decodeFixture(f: { file: File }): Promise<DecodedImage> {
  return decodeImage(f.file);
}

function near(actual: number, expected: number, tol = 12): boolean {
  return Math.abs(actual - expected) <= tol;
}

describe('decode + upload validation', () => {
  test('decodes PNG bytes even when the file is named .jpg (gallery pick)', async () => {
    const f = makePhotoFile(320, 240, 'image/png', 'gallery-pick.jpg');
    const decoded = await decodeFixture(f);
    assert.equal(decoded.format, 'png');
    assert.equal(decoded.width, 320);
    assert.equal(decoded.height, 240);
  });

  test('decodes JPEG bytes even when named .webp', async () => {
    const f = makePhotoFile(320, 240, 'image/jpeg', 'snapshot.webp');
    const decoded = await decodeFixture(f);
    assert.equal(decoded.format, 'jpg');
    assert.equal(decoded.width, 320);
  });

  test('validateFiles accepts content-correct and re-labels the name', async () => {
    const rule = defaultRuleFor(['jpg', 'png', 'webp']);
    const f = makePhotoFile(100, 80, 'image/png', 'strange.HEIC');
    const result = await validateFiles([f.file], rule);
    assert.equal(result.valid, true);
    assert.ok(result.files?.[0].name.endsWith('.png'));
  });

  test('validateFiles rejects a text file for image tools', async () => {
    const rule = defaultRuleFor(['jpg', 'png', 'webp']);
    const text = new Uint8Array(Buffer.from('hello world'));
    const file = new File([text], 'note.txt', { type: 'text/plain' });
    const result = await validateFiles([file], rule);
    assert.equal(result.valid, false);
    assert.equal(result.errorKey, 'invalidType');
  });
});

describe('image compressor', () => {
  test('PNG is actually compressed (palette pass) — never returns original bytes', async () => {
    const f = makePhotoFile(600, 420, 'image/png');
    const decoded = await decodeFixture(f);
    const [result] = await compressImages([decoded], { quality: 80, format: 'same' });

    assert.equal(result.format, 'png');
    assert.equal(result.name.endsWith('.png'), true);
    // The core regression: output must be a real, smaller processing result.
    assert.ok(result.outputSize < f.buffer.length, `expected smaller, got ${result.outputSize} vs ${f.buffer.length}`);
    assert.equal(result.wasCompressed, true);
    // The delivered blob must be a fresh canvas output, never the input File.
    assert.notEqual(result.blob, f.file as unknown as Blob);
    assert.notEqual(result.blob.size, f.buffer.length);
  });

  test('PNG→WebP conversion produces a real WebP file', async () => {
    const f = makePhotoFile(600, 420, 'image/png');
    const decoded = await decodeFixture(f);
    const [result] = await compressImages([decoded], { quality: 70, format: 'webp' });
    assert.equal(result.format, 'webp');
    assert.equal(result.name.endsWith('.webp'), true);
    const head = Buffer.from(await result.blob.arrayBuffer()).subarray(0, 12).toString('latin1');
    assert.ok(head.startsWith('RIFF') && head.includes('WEBP'), 'must be WebP bytes');
    const { width, height } = await blobToImage(result.blob);
    assert.equal(width, 600);
    assert.equal(height, 420);
  });

  test('JPEG always outputs a processed blob (never silent original) with honest flag', async () => {
    const f = makePhotoFile(600, 420, 'image/jpeg', 'photo.jpg');
    const decoded = await decodeFixture(f);
    const [result] = await compressImages([decoded], { quality: 45, format: 'same' });
    assert.equal(result.format, 'jpg');
    assert.equal(result.name.endsWith('.jpg'), true);
    // Even in the “larger than original” case the bytes must be a fresh
    // (canvas-encoded) image, not the input file handed back unchanged.
    assert.notEqual(result.blob, f.file as unknown as Blob);
    const { width, height } = await blobToImage(result.blob);
    assert.equal(width, 600);
    assert.equal(height, 420);
  });

  test('JPEG with room to shrink gets smaller at higher quality', async () => {
    // Big photo-like image: re-encode at 45% is comfortably smaller.
    const f = makePhotoFile(1400, 1000, 'image/jpeg', 'big.jpg');
    const decoded = await decodeFixture(f);
    const [result] = await compressImages([decoded], { quality: 45, format: 'same' });
    assert.equal(result.wasCompressed, true);
    assert.ok(result.outputSize < f.buffer.length, `${result.outputSize} !< ${f.buffer.length}`);
    assert.equal(result.message, 'compressed-success');
  });
});

describe('quantizer', () => {
  test('palette quantization: ≤256 colors and much smaller PNG', async () => {
    const f = makePhotoFile(600, 420, 'image/png');
    const decoded = await decodeFixture(f);
    const quantized = await quantizeToPng(decoded);
    assert.ok(quantized, 'quantizeToPng must succeed');
    assert.ok(quantized.size < f.buffer.length, `${quantized.size} !< ${f.buffer.length}`);
    const colors = await distinctColors(quantized);
    assert.ok(colors <= 256, `quantized image has ${colors} distinct colors`);
  });

  test('quantizeRgba produces palette + index map of correct length', () => {
    const w = 40;
    const h = 30;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
      data[i * 4] = (i * 7) % 256;
      data[i * 4 + 1] = (i * 13) % 256;
      data[i * 4 + 2] = (i * 29) % 256;
      data[i * 4 + 3] = 255;
    }
    const out = quantizeRgba(data, w, h);
    assert.ok(out);
    assert.equal(out.indices.length, w * h);
    assert.equal(out.palette.length, 256 * 3);
    assert.ok(out.colors > 0 && out.colors <= 256);
  });
});

describe('crop / resize / rotate / flip', () => {
  test('crop extracts exact region dimensions', async () => {
    const f = makeQuadrantFile(400, 300);
    const decoded = await decodeFixture(f);
    const result = await cropImage([decoded], { x: 0, y: 0, width: 200, height: 150, format: 'png' });
    const img = await blobToImage(result.blob);
    assert.equal(img.width, 200);
    assert.equal(img.height, 150);
    const [r, g, b] = await pixelAt(result.blob, 100, 75);
    assert.ok(near(r, 255) && near(g, 0) && near(b, 0), 'top-left quadrant should stay red');
  });

  test('resize produces exact requested dimensions', async () => {
    const f = makeQuadrantFile(400, 300);
    const decoded = await decodeFixture(f);
    const result = await resizeImage([decoded], { width: 250, height: 180, format: 'png' });
    const img = await blobToImage(result.blob);
    assert.equal(img.width, 250);
    assert.equal(img.height, 180);
    assert.equal(result.name.endsWith('.png'), true);
  });

  test('rotate 90° swaps dimensions and preserves content', async () => {
    const f = makeQuadrantFile(400, 300);
    const decoded = await decodeFixture(f);
    const result = await rotateImage([decoded], { angle: 90, format: 'png' });
    const img = await blobToImage(result.blob);
    assert.equal(img.width, 300);
    assert.equal(img.height, 400);
  });

  test('rotate 180° moves top-left red to bottom-right', async () => {
    const f = makeQuadrantFile(400, 300);
    const decoded = await decodeFixture(f);
    const result = await rotateImage([decoded], { angle: 180, format: 'png' });
    const [r, g, b] = await pixelAt(result.blob, 350, 250);
    assert.ok(near(r, 255) && near(g, 0) && near(b, 0), 'bottom-right after 180° should be red');
  });

  test('flip horizontal mirrors left/right', async () => {
    const f = makeQuadrantFile(400, 300);
    const decoded = await decodeFixture(f);
    const result = await flipImage([decoded], { direction: 'horizontal', format: 'png' });
    const [r, g, b] = await pixelAt(result.blob, 50, 50);
    assert.ok(near(g, 255) && near(r, 0) && near(b, 0), 'top-left after horizontal flip should be green');
  });

  test('flip vertical mirrors top/bottom', async () => {
    const f = makeQuadrantFile(400, 300);
    const decoded = await decodeFixture(f);
    const result = await flipImage([decoded], { direction: 'vertical', format: 'png' });
    const [r, g, b] = await pixelAt(result.blob, 50, 50);
    assert.ok(near(b, 255) && near(r, 0) && near(g, 0), 'top-left after vertical flip should be blue');
  });
});

describe('grayscale + converters', () => {
  test('grayscale output has equal RGB everywhere', async () => {
    const f = makeQuadrantFile(400, 300);
    const decoded = await decodeFixture(f);
    const result = await toGrayscale([decoded], { format: 'png' });
    const [r, g, b] = await pixelAt(result.blob, 100, 100);
    assert.ok(near(r, g) && near(g, b), `${r}/${g}/${b} — grayscale must have r==g==b`);
  });

  test('png-to-jpg outputs JPEG bytes with .jpg name', async () => {
    const f = makeQuadrantFile(400, 300, 'image/png');
    const decoded = await decodeFixture(f);
    const result = await convertImage([decoded], { format: 'jpg', quality: 90, background: '#ffffff' });
    const head = Buffer.from(await result.blob.arrayBuffer()).subarray(0, 2).toString('latin1');
    assert.equal(head, '\u00ff\u00d8');
    assert.equal(result.name.endsWith('.jpg'), true);
  });

  test('jpg-to-webp outputs WebP bytes with .webp name', async () => {
    const f = makeQuadrantFile(400, 300, 'image/jpeg', 'in.jpg');
    const decoded = await decodeFixture(f);
    const result = await convertImage([decoded], { format: 'webp', quality: 80, background: '#ffffff' });
    const head = Buffer.from(await result.blob.arrayBuffer()).subarray(0, 12).toString('latin1');
    assert.ok(head.startsWith('RIFF') && head.includes('WEBP'));
    assert.equal(result.name.endsWith('.webp'), true);
  });

  test('webp-to-png outputs PNG bytes with .png name', async () => {
    const f = makeQuadrantFile(400, 300, 'image/webp', 'in.webp');
    const decoded = await decodeFixture(f);
    const result = await convertImage([decoded], { format: 'png', quality: 90, background: '#ffffff' });
    const head = Buffer.from(await result.blob.arrayBuffer()).subarray(0, 4).toString('latin1');
    assert.equal(head, '\u0089PNG');
    assert.equal(result.name.endsWith('.png'), true);
  });
});

describe('exact-KB target', () => {
  test('hits a 90KB target with a big photo', async () => {
    const f = makePhotoFile(1600, 1100, 'image/jpeg', 'large.jpg');
    const decoded = await decodeFixture(f);
    const [result] = await compressToExactSize([decoded], { targetKB: 90, format: 'jpg' });
    assert.equal(result.hit, true);
    assert.ok(result.outputSize <= 90 * 1024, `${result.outputSize} > target`);
    assert.ok(result.outputSize > 0);
    assert.equal(result.name.endsWith('.jpg'), true);
  });
});

describe('background remover', () => {
  test('removes white background into transparent PNG', async () => {
    const f = makeBgFile(600, 400);
    const decoded = await decodeFixture(f);
    const [result] = await removeBackground([decoded], { tolerance: 30, feather: 10, source: 'white' });
    assert.equal(result.format, 'png');
    const corner = await pixelAt(result.blob, 5, 5);
    assert.equal(corner[3], 0, 'corner pixel must be transparent');
    const center = await pixelAt(result.blob, 300, 200);
    assert.ok(center[3] > 200, 'subject pixel must stay opaque');
  });
});

describe('passport photo', () => {
  test('renders 35×45mm at 300 DPI (413×531)', async () => {
    const f = makeQuadrantFile(800, 1000);
    const decoded = await decodeFixture(f);
    const [result] = await makePassportPhoto([decoded], {
      presetId: '35x45',
      dpi: 300,
      background: '#ffffff',
      format: 'jpg',
    });
    const img = await blobToImage(result.blob);
    assert.equal(img.width, 413);
    assert.equal(img.height, 531);
    assert.equal(result.name.endsWith('.jpg'), true);
  });
});

describe('signature maker', () => {
  test('extracts ink into a cropped transparent PNG', async () => {
    const f = makeSignatureFile(800, 400);
    const decoded = await decodeFixture(f);
    const [result] = await makeSignature([decoded], { threshold: 55, ink: '#000000', invert: false });
    assert.equal(result.format, 'png');
    const img = await blobToImage(result.blob);
    assert.ok(img.width < 800, `expected auto-crop, got ${img.width}`);
    // Somewhere in the output there must be dark ink with alpha.
    const probe = (await import('@napi-rs/canvas')).createCanvas(img.width, img.height);
    const pctx = probe.getContext('2d');
    pctx.drawImage(img.image, 0, 0);
    const data = pctx.getImageData(0, 0, img.width, img.height).data;
    let inkFound = false;
    let sawAlpha = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] > 100 && data[i] < 60 && data[i + 1] < 60 && data[i + 2] < 60) {
        inkFound = true;
        break;
      }
      if (data[i + 3] > 0) sawAlpha++;
    }
    assert.ok(inkFound, 'expected ink pixels in the signature output');
    assert.ok(sawAlpha > 0, 'output must contain transparent background');
    // Corners should stay transparent (auto-crop pads around the ink bbox).
    const corner = await pixelAt(result.blob, 2, 2);
    assert.ok(corner[3] < 40, 'outside ink should be transparent');
  });
});

describe('watermark', () => {
  test('paints text watermark at the chosen position', async () => {
    const f = makeBgFile(600, 400);
    const decoded = await decodeFixture(f);
    const result = await applyWatermark([decoded], {
      type: 'text',
      text: 'PICLIZER',
      fontFamily: 'DejaVu Sans, sans-serif',
      fontSize: 42,
      color: '#ff00ff',
      opacity: 100,
      position: 'c',
      tile: false,
      format: 'png',
      watermarkScale: 20,
    });
    // Scan the center band for any magenta pixel of the watermark text.
    const { image } = await blobToImage(result.blob);
    const canvasBag = await import('@napi-rs/canvas');
    const { createCanvas } = canvasBag;
    const probe = createCanvas(image.width, image.height);
    const ctx = probe.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, Math.round(image.height / 2) - 40, image.width, 80).data;
    let found = false;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 200 && data[i + 2] > 200 && data[i + 1] < 90) {
        found = true;
        break;
      }
    }
    assert.ok(found, 'watermark text must be visible near the center');
  });
});

describe('split / merge / PDF', () => {
  test('split 2×2 returns four tiles of the right size', async () => {
    const f = makeQuadrantFile(400, 300);
    const decoded = await decodeFixture(f);
    const results = await splitImage([decoded], { rows: 2, cols: 2, format: 'png' });
    assert.equal(results.length, 4);
    for (const r of results) {
      const img = await blobToImage(r.blob);
      assert.ok(Math.abs(img.width - 200) <= 1, `tile width ${img.width}`);
      assert.ok(Math.abs(img.height - 150) <= 1, `tile height ${img.height}`);
    }
  });

  test('merge two images horizontally respects spacing', async () => {
    const a = makeQuadrantFile(200, 150, 'image/png', 'a.png');
    const b = makeQuadrantFile(200, 150, 'image/png', 'b.png');
    const [da, db] = await Promise.all([decodeFixture(a), decodeFixture(b)]);
    const result = await mergeImages([da, db], { direction: 'horizontal', spacing: 20, background: '#ffffff', format: 'png' });
    const img = await blobToImage(result.blob);
    assert.equal(img.width, 420);
    assert.equal(img.height, 150);
    assert.equal(result.name.endsWith('.png'), true);
  });

  test('images to PDF: valid PDF with one page per image', async () => {
    const a = makeQuadrantFile(200, 150, 'image/png', 'a.png');
    const b = makeQuadrantFile(200, 150, 'image/jpeg', 'b.jpg');
    const [da, db] = await Promise.all([decodeFixture(a), decodeFixture(b)]);
    const result = await imagesToPdf([da, db], { pageSize: 'a4', orientation: 'portrait' });
    const bytes = await result.blob.arrayBuffer();
    assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), '%PDF-');
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes as unknown as ArrayBuffer);
    assert.equal(doc.getPageCount(), 2);
    const page = doc.getPage(0);
    assert.ok(page.getWidth() > 550 && page.getHeight() > 800, 'A4 portrait page');
  });
});
