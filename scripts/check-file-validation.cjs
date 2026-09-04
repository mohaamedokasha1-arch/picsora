#!/usr/bin/env node
/**
 * Regression check for the shared upload validation used by every Piclizer tool.
 *
 * It loads the real `lib/validation.ts` and `lib/image/format.ts` (no copies, no
 * mocks of the logic under test) and runs them against the file shapes that real
 * devices produce: iPhone HEIC, extension-less Android picks, PNGs saved as
 * `.jpg`, big-endian TIFFs, and so on.
 *
 * Run with:  node scripts/check-file-validation.cjs
 */
'use strict';

const path = require('path');
const Module = require('module');

const ROOT = path.resolve(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');

// --- Load TypeScript sources with the sucrase transform Next.js already ships. ---
const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
  if (request === 'sucrase/register/ts' || request === 'sucrase') {
    return origResolve.call(this, path.join(NM, request), parent, ...rest);
  }
  if (request.startsWith('@/')) {
    return origResolve.call(this, path.join(ROOT, request.slice(2)), parent, ...rest);
  }
  return origResolve.call(this, request, parent, ...rest);
};
require(path.join(NM, 'sucrase/register/ts'));

// --- Minimal browser polyfills so the client-side code runs under Node. ---
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReader {
    onload = null;
    onerror = null;
    result = null;
    readAsArrayBuffer(blob) {
      blob
        .arrayBuffer()
        .then((buf) => {
          this.result = buf;
          if (this.onload) this.onload({ target: this });
        })
        .catch((err) => {
          if (this.onerror) this.onerror({ target: this, error: err });
        });
    }
  };
}

const { validateFile, defaultRuleFor } = require(path.join(ROOT, 'lib/validation.ts'));

// --- Realistic file headers. Each is padded past the sniffer window. ---
const HEADS = {
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1]),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]),
  webp: Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]),
  gif: Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0]),
  bmp: Buffer.from([0x42, 0x4d, 0x36, 0, 0, 0, 0, 0, 0, 0, 0x36, 0, 0, 0, 0x28, 0]),
  tiffLE: Buffer.from([0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0xfe, 0, 4, 0, 0, 0]),
  tiffBE: Buffer.from([0x4d, 0x4d, 0, 0x2a, 0, 0, 0, 8, 0, 1, 0, 0xfe, 0, 4, 0, 0]),
  avif: Buffer.from([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66, 0, 0, 0, 0]),
  heic: Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0]),
  ico: Buffer.from([0, 0, 1, 0, 1, 0, 16, 16, 0, 0, 1, 0, 32, 0, 0x68, 0x04]),
  svgPlain: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"></svg>'),
  svgProlog: Buffer.from('<?xml version="1.0" encoding="UTF-8"?>\n<!-- logo -->\n<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  pdf: Buffer.from('%PDF-1.7\n%\xe2\xe3\xcf\xd3\n'),
  exe: Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0, 0xff, 0xff, 0, 0]),
  elf: Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  random: Buffer.from([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0, 1, 2, 3, 4, 5, 6, 7]),
};

const file = (name, head, type, pad = 4096) =>
  new File([Buffer.concat([HEADS[head], Buffer.alloc(pad, 0)])], name, { type });

// Rule used by most image tools (image-compressor, image-cropper, …).
const IMG = defaultRuleFor(['jpg', 'png', 'webp'], 20, 50);
// A converter tool with a single declared input format.
const PNG_ONLY = defaultRuleFor(['png'], 10, 50);
// PDF-only tools.
const PDF = defaultRuleFor(['pdf'], 20, 50);

/** [description, file, rule, expectedValid, expectedErrorKeyWhenInvalid] */
const CASES = [
  // --- Desktop, well-formed ------------------------------------------------
  ['desktop photo.jpg', file('photo.jpg', 'jpg', 'image/jpeg'), IMG, true],
  ['desktop shot.png', file('shot.png', 'png', 'image/png'), IMG, true],
  ['desktop thumb.webp', file('thumb.webp', 'webp', 'image/webp'), IMG, true],
  ['upper-case PHOTO.JPG', file('PHOTO.JPG', 'jpg', 'image/jpeg'), IMG, true],
  ['double extension photo.final.jpg', file('photo.final.jpg', 'jpg', 'image/jpeg'), IMG, true],
  ['extension .jpeg', file('photo.jpeg', 'jpg', 'image/jpeg'), IMG, true],
  ['extension .jfif', file('photo.jfif', 'jpg', 'image/jpeg'), IMG, true],

  // --- Mobile cameras ------------------------------------------------------
  ['iPhone IMG_0231.HEIC', file('IMG_0231.HEIC', 'heic', 'image/heic'), IMG, true],
  ['iPhone heic reported as octet-stream', file('IMG_0231.heic', 'heic', 'application/octet-stream'), IMG, true],
  ['Android pick with no extension', file('1717634000123', 'jpg', 'image/jpeg'), IMG, true],
  ['WhatsApp-style name "image"', file('image', 'jpg', 'image/jpeg'), IMG, true],
  ['download with no extension', file('photo', 'png', 'image/png'), IMG, true],
  ['Android non-standard image/jpg', file('photo.jpg', 'jpg', 'image/jpg'), IMG, true],
  ['Windows image/x-ms-bmp', file('scan.bmp', 'bmp', 'image/x-ms-bmp'), IMG, true],
  ['no extension and no MIME type', file('IMG_9001', 'jpg', ''), IMG, true],

  // --- Mislabelled but perfectly decodable ---------------------------------
  ['PNG bytes named .jpg', file('IMG_5512.jpg', 'png', 'image/png'), IMG, true],
  ['WebP bytes named .jpg', file('thumb.jpg', 'webp', 'image/webp'), IMG, true],
  ['JPEG bytes named .png', file('export.png', 'jpg', 'image/jpeg'), PNG_ONLY, true],

  // --- Other raster/vector formats ----------------------------------------
  ['gif', file('anim.gif', 'gif', 'image/gif'), IMG, true],
  ['bmp', file('scan.bmp', 'bmp', 'image/bmp'), IMG, true],
  ['tiff little-endian', file('scan.tiff', 'tiffLE', 'image/tiff'), IMG, true],
  ['tiff big-endian', file('scan.tiff', 'tiffBE', 'image/tiff'), IMG, true],
  ['tif short extension', file('scan.tif', 'tiffLE', 'image/tiff'), IMG, true],
  ['avif', file('photo.avif', 'avif', 'image/avif'), IMG, true],
  ['svg plain', file('logo.svg', 'svgPlain', 'image/svg+xml'), IMG, true],
  ['svg with XML prolog and comment', file('logo.svg', 'svgProlog', 'image/svg+xml'), IMG, true],
  ['ico', file('favicon.ico', 'ico', 'image/x-icon'), IMG, true],

  // --- Must still be rejected ---------------------------------------------
  ['empty file', new File([], 'a.jpg', { type: 'image/jpeg' }), IMG, false, 'emptyFile'],
  ['oversized file', new File([Buffer.alloc(51 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' }), IMG, false, 'fileTooLarge'],
  ['renamed .exe', file('evil.exe', 'exe', 'application/x-msdownload'), IMG, false, 'invalidType'],
  ['exe bytes named .jpg', file('evil.jpg', 'exe', 'image/jpeg'), IMG, false, 'invalidType'],
  ['elf bytes named .png', file('evil.png', 'elf', 'image/png'), IMG, false, 'invalidType'],
  ['text file named .jpg', new File([Buffer.from('just some text, not an image at all')], 'x.jpg', { type: 'text/plain' }), IMG, false, 'invalidType'],
  ['image offered to a PDF-only tool', file('photo.jpg', 'jpg', 'image/jpeg'), PDF, false, 'invalidType'],

  // --- PDF tools -----------------------------------------------------------
  ['valid pdf', file('doc.pdf', 'pdf', 'application/pdf'), PDF, true],
  ['pdf with no extension', file('doc', 'pdf', 'application/pdf'), PDF, true],
  ['pdf reported as octet-stream', file('doc.pdf', 'pdf', 'application/octet-stream'), PDF, true],
  ['pdf with no extension and no MIME', file('doc', 'pdf', ''), PDF, true],
  ['exe renamed to .pdf', file('evil.pdf', 'exe', 'application/pdf'), PDF, false, 'invalidPdf'],
  ['jpg renamed to .pdf', file('photo.pdf', 'jpg', 'application/pdf'), PDF, false, 'invalidPdf'],
];

(async () => {
  let passed = 0;
  const failures = [];

  for (const [label, f, rule, expected, expectedKey] of CASES) {
    const result = await validateFile(f, rule);
    const ok = result.valid === expected && (!expected ? result.errorKey === expectedKey : true);
    if (ok) {
      passed++;
      console.log(`  ok   ${label} -> ${result.valid ? 'accepted' : `rejected(${result.errorKey})`}`);
    } else {
      const got = result.valid ? 'accepted' : `rejected(${result.errorKey})`;
      const want = expected ? 'accepted' : `rejected(${expectedKey})`;
      failures.push(`${label}: expected ${want}, got ${got}`);
      console.log(`  FAIL ${label}: expected ${want}, got ${got}`);
    }
  }

  console.log('');
  console.log(`accept attribute (image rule): ${IMG.accept}`);
  console.log(`accept attribute (pdf rule):   ${PDF.accept}`);
  console.log('');
  console.log(`${passed}/${CASES.length} checks passed`);

  // Every format we now accept must also survive the rest of the pipeline:
  // `decoded.format` is fed straight to the canvas encoder, so a format with no
  // encoder would fail *after* upload with a confusing error.
  const { encodableFormat, mimeFromExt } = require(path.join(ROOT, 'lib/image/format.ts'));
  const ENCODABLE = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const families = ['jpg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'avif', 'heic', 'svg', 'ico'];
  const notEncodable = [];
  console.log('');
  for (const family of families) {
    const out = encodableFormat(family);
    const mime = mimeFromExt(out);
    const ok = ENCODABLE.includes(mime);
    if (!ok) notEncodable.push(family);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${family} -> '${out}' -> ${mime}`);
  }

  if (failures.length || notEncodable.length) {
    console.error('\nFAILURES:');
    failures.forEach((f) => console.error(' - ' + f));
    notEncodable.forEach((f) => console.error(` - ${f} has no encodable output format`));
    process.exit(1);
  }
  console.log('\nAll upload-validation checks passed.');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
