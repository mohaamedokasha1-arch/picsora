/**
 * Behavioural verification for the gallery-pick validation fix.
 * Run with:  npx tsx scripts/verify-gallery-validation.ts
 *
 * Recreates the exact File objects mobile photo pickers hand to the browser:
 * missing/extension-less names, empty or generic MIME types, and gallery
 * transcodes (JPEG bytes named .HEIC, PNG screenshots named .jpg, …).
 */
import { validateFiles, normalizeUploadedFile, defaultRuleFor } from '@/lib/validation';
import { sniffFormatFromBytes, detectFileFormat } from '@/lib/image/format';
import type { UploadExtension } from '@/lib/validation';

// ── byte fixtures ───────────────────────────────────────────────────────────
const u8 = (...b: number[]) => new Uint8Array(b);
const str = (s: string) => [...s].map((c) => c.charCodeAt(0));

const JPEG_BYTES = u8(0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, ...Array(64).fill(0xab));
const JPEG_EXIF = u8(0xff, 0xd8, 0xff, 0xe1, 0, 16, ...Array(64).fill(0xcd)); // camera photo variant
const PNG_BYTES = u8(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, ...Array(64).fill(0x11));
const WEBP_BYTES = u8(...str('RIFF'), 0x24, 0, 0, 0, ...str('WEBPVP8 '), ...Array(64).fill(0x22));
const GIF_BYTES = u8(...str('GIF89a'), ...Array(64).fill(0x33));
const BMP_BYTES = u8(...str('BM'), ...Array(64).fill(0x44));
const HEIC_BYTES = u8(0, 0, 0, 24, ...str('ftypheic'), 0, 0, 0, 0, ...str('heicmif1'), ...Array(32).fill(0x55));
const MIF1_AVIF = u8(0, 0, 0, 28, ...str('ftypmif1'), 0, 0, 0, 0, ...str('miaf'), ...str('avif'), ...Array(32).fill(0x66));
const MIF1_HEIC = u8(0, 0, 0, 28, ...str('ftypmif1'), 0, 0, 0, 0, ...str('mif1'), ...str('heic'), ...Array(32).fill(0x77));
const SVG_CLEAN = new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>`);
const SVG_EVIL = new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`);
const PDF_BYTES = new TextEncoder().encode(`%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF`);
const EXOTIC_BYTES = u8(0, 0, 0, 24, ...str('ftypXYZW'), 0, 0, 0, 0, ...Array(48).fill(0x99)); // unrecognised container

// ── rules (mirroring the registry after IPHONE_EXTRA patch) ────────────────
const compressorRule = defaultRuleFor(['jpg', 'png', 'webp', 'heic', 'heif'] as UploadExtension[], 20, 50);
const convertRule = defaultRuleFor(
  ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff', 'tif', 'avif', 'svg', 'heic', 'heif'] as UploadExtension[],
  10,
  50,
);
const resizerRule = defaultRuleFor(['jpg', 'png', 'webp', 'gif', 'heic', 'heif'] as UploadExtension[], 1, 50);
const pdfRule = defaultRuleFor(['pdf'] as UploadExtension[], 20, 50);

const mkFile = (bytes: Uint8Array, name: string, type: string) =>
  new File([bytes.slice().buffer as ArrayBuffer], name, { type, lastModified: 1700000000000 });

let failures = 0;
let passes = 0;
function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passes++;
    console.log(`  ✅ ${label}`);
  } else {
    failures++;
    console.error(`  ❌ ${label} ${detail}`);
  }
}

async function expectAccept(label: string, file: File, rule = compressorRule, expectName?: string, expectType?: string) {
  const res = await validateFiles([file], rule);
  if (!res.valid) {
    check(label, false, `— REJECTED with ${res.errorKey}`);
    return;
  }
  const out = res.files![0];
  let ok = true;
  let detail = '';
  if (expectName !== undefined && out.name !== expectName) {
    ok = false;
    detail += ` name=${JSON.stringify(out.name)} want ${JSON.stringify(expectName)}`;
  }
  if (expectType !== undefined && out.type !== expectType) {
    ok = false;
    detail += ` type=${JSON.stringify(out.type)} want ${JSON.stringify(expectType)}`;
  }
  check(label + (expectName ? ` → "${expectName}" [${expectType}]` : ''), ok, detail);
}

async function expectReject(label: string, file: File, rule = compressorRule) {
  const res = await validateFiles([file], rule);
  check(label + ` → rejected (${res.errorKey ?? '?'})`, !res.valid, res.valid ? '— ACCEPTED but should be rejected' : '');
}

async function main() {
  console.log('\n══ 1. Gallery picks WITHOUT extension / name / MIME (the main bug) ══');
  await expectAccept('Android picker "image:47" (JPEG bytes, no type)', mkFile(JPEG_BYTES, 'image:47', ''), compressorRule, 'image_47.jpg', 'image/jpeg');
  await expectAccept('Android picker "1000012345" (JPEG bytes, no type)', mkFile(JPEG_EXIF, '1000012345', ''), compressorRule, '1000012345.jpg', 'image/jpeg');
  await expectAccept('EMPTY name (PNG bytes, no type)', mkFile(PNG_BYTES, '', ''), compressorRule, 'image.png', 'image/png');
  await expectAccept('Empty name + generic octet-stream type (JPEG)', mkFile(JPEG_BYTES, '', 'application/octet-stream'), compressorRule, 'image.jpg', 'image/jpeg');
  await expectAccept('No extension but MIME image/webp (WebP bytes)', mkFile(WEBP_BYTES, 'media_pick_9', 'image/webp'), compressorRule, 'media_pick_9.webp', 'image/webp');
  await expectAccept('Screenshot "Screenshot_20260905_120000" no ext (PNG)', mkFile(PNG_BYTES, 'Screenshot_20260905_120000', ''), compressorRule, 'Screenshot_20260905_120000.png', 'image/png');
  await expectAccept('Arabic name without extension (JPEG)', mkFile(JPEG_BYTES, 'صورة من المعرض', ''), compressorRule, 'صورة من المعرض.jpg', 'image/jpeg');

  console.log('\n══ 2. Gallery TRANSCODES: content ≠ name (camera photos & screenshots) ══');
  await expectAccept('iOS share: JPEG bytes named IMG_1234.HEIC', mkFile(JPEG_EXIF, 'IMG_1234.HEIC', 'image/heic'), compressorRule, 'IMG_1234.jpg', 'image/jpeg');
  await expectAccept('iOS share: JPEG bytes named .heic, type image/heif', mkFile(JPEG_BYTES, 'photo.heic', 'image/heif'), compressorRule, 'photo.jpg', 'image/jpeg');
  await expectAccept('Android gallery: PNG bytes named Screenshot.jpg', mkFile(PNG_BYTES, 'Screenshot_2026.jpg', 'image/jpeg'), compressorRule, 'Screenshot_2026.png', 'image/png');
  await expectAccept('Android gallery: JPEG bytes named shot.png', mkFile(JPEG_BYTES, 'shot.png', 'image/png'), compressorRule, 'shot.jpg', 'image/jpeg');
  await expectAccept('GIF bytes named photo.jpg (resizer accepts gif)', mkFile(GIF_BYTES, 'photo.jpg', 'image/jpeg'), resizerRule, 'photo.gif', 'image/gif');
  await expectAccept('HEIC bytes named image.jpg (files app quirk)', mkFile(HEIC_BYTES, 'image.jpg', 'image/jpeg'), compressorRule, 'image.heic', 'image/heic');

  console.log('\n══ 3. Correctly-labelled files must pass UNCHANGED (idempotent) ══');
  {
    const f = mkFile(JPEG_BYTES, 'photo.jpeg', 'image/jpeg');
    await expectAccept('photo.jpeg / image/jpeg', f, compressorRule, 'photo.jpeg', 'image/jpeg');
    const once = await normalizeUploadedFile(f);
    const twice = await normalizeUploadedFile(once);
    check('normalisation is idempotent (same reference)', once === twice);
    const heic = mkFile(HEIC_BYTES, 'IMG_5678.heic', 'image/heic');
    await expectAccept('real HEIC named .heic', heic, compressorRule, 'IMG_5678.heic', 'image/heic');
    check('real HEIC object kept identical', (await normalizeUploadedFile(heic)) === heic);
    await expectAccept('uppercase ext PHOTO.PNG', mkFile(PNG_BYTES, 'PHOTO.PNG', 'image/png'), compressorRule, 'PHOTO.PNG', 'image/png');
    await expectAccept('webp + correct labels', mkFile(WEBP_BYTES, 'anim.webp', 'image/webp'), compressorRule, 'anim.webp', 'image/webp');
  }

  console.log('\n══ 4. HEIC/AVIF family detection (mif1 compatible brands) ══');
  check('mif1 + avif compatible → avif', sniffFormatFromBytes(MIF1_AVIF) === 'avif', `got ${sniffFormatFromBytes(MIF1_AVIF)}`);
  check('mif1 + heic compatible → heic', sniffFormatFromBytes(MIF1_HEIC) === 'heic', `got ${sniffFormatFromBytes(MIF1_HEIC)}`);
  check('major brand heic → heic', sniffFormatFromBytes(HEIC_BYTES) === 'heic');
  await expectAccept('mif1/avif bytes named pick (convert rule)', mkFile(MIF1_AVIF, 'pick', ''), convertRule, 'pick.avif', 'image/avif');
  await expectAccept('exotic container, no ext, MIME image/heic → lenient accept', mkFile(EXOTIC_BYTES, 'IMG_9.heic', 'image/heic'), compressorRule, 'IMG_9.heic', 'image/heic');
  await expectAccept('exotic bytes, nameless, MIME image/heic → lenient accept', mkFile(EXOTIC_BYTES, '', 'image/heic'), compressorRule, 'image.heic', 'image/heic');

  console.log('\n══ 5. Cross-format rules (compressor does NOT take gif/bmp/svg/pdf) ══');
  await expectReject('GIF bytes named x.jpg for compressor? no — jpg rule lacks gif', mkFile(GIF_BYTES, 'x.jpg', 'image/jpeg'), compressorRule);
  await expectAccept('BMP bytes named x (convert rule allows bmp)', mkFile(BMP_BYTES, 'x', ''), convertRule, 'x.bmp', 'image/bmp');
  await expectReject('PDF bytes named doc.jpg for image tool', mkFile(PDF_BYTES, 'doc.jpg', 'image/jpeg'), compressorRule);
  await expectAccept('PDF bytes named "document" (no ext) for PDF tool', mkFile(PDF_BYTES, 'document', ''), pdfRule, 'document.pdf', 'application/pdf');
  await expectReject('JPEG bytes for PDF tool', mkFile(JPEG_BYTES, 'photo.jpg', 'image/jpeg'), pdfRule);
  await expectAccept('real PDF with .pdf name passes unchanged', mkFile(PDF_BYTES, 'file.pdf', 'application/pdf'), pdfRule, 'file.pdf', 'application/pdf');

  console.log('\n══ 6. SVG handling ══');
  await expectAccept('clean SVG named logo.svg (convert rule)', mkFile(SVG_CLEAN, 'logo.svg', 'image/svg+xml'), convertRule, 'logo.svg', 'image/svg+xml');
  await expectAccept('clean SVG bytes, no extension (convert rule)', mkFile(SVG_CLEAN, 'vector-art', ''), convertRule, 'vector-art.svg', 'image/svg+xml');
  await expectReject('SVG with <script> named logo.svg', mkFile(SVG_EVIL, 'logo.svg', 'image/svg+xml'), convertRule);
  await expectReject('SVG with <script>, no extension', mkFile(SVG_EVIL, 'art', 'image/svg+xml'), convertRule);
  await expectReject('SVG bytes named photo.jpg (polyglot guard)', mkFile(SVG_CLEAN, 'photo.jpg', 'image/jpeg'), convertRule);
  await expectReject('SVG content for compressor (svg not allowed)', mkFile(SVG_CLEAN, 'logo.svg', 'image/svg+xml'), compressorRule);

  console.log('\n══ 7. Security checks still enforced ══');
  await expectReject('evil.exe (PNG bytes inside)', mkFile(PNG_BYTES, 'evil.exe', 'image/png'));
  await expectReject('evil.exe.png double extension', mkFile(PNG_BYTES, 'evil.exe.png', 'image/png'));
  await expectReject('evil.png.exe', mkFile(PNG_BYTES, 'evil.png.exe', 'image/png'));
  await expectReject('path traversal ../secret.png', mkFile(PNG_BYTES, '../secret.png', 'image/png'));
  await expectReject('bidi spoofed name', mkFile(PNG_BYTES, 'photo\u202Egnp.exe', 'image/png'));
  await expectReject('empty file (0 bytes)', mkFile(new Uint8Array(0), 'empty.jpg', 'image/jpeg'));
  await expectReject('HTML bytes named .jpg + text/html MIME', mkFile(new TextEncoder().encode('<!DOCTYPE html><html></html>'), 'page.jpg', 'text/html'));
  {
    const huge = new File([JPEG_BYTES], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(huge, 'size', { value: 60 * 1024 * 1024 });
    const res2 = await validateFiles([huge], compressorRule);
    check('oversized file rejected', !res2.valid && res2.errorKey === 'fileTooLarge', `got ${res2.errorKey}`);
  }

  console.log('\n══ 8. detectFileFormat (content-first resolution used by decodeImage) ══');
  check('JPEG bytes named .HEIC → jpg (NOT routed to heic2any)', (await detectFileFormat(mkFile(JPEG_EXIF, 'IMG_1.HEIC', 'image/heic'))) === 'jpg');
  check('no-name PNG → png', (await detectFileFormat(mkFile(PNG_BYTES, '', ''))) === 'png');
  check('exotic bytes + .heic name → heic (lenient)', (await detectFileFormat(mkFile(EXOTIC_BYTES, 'x.heic', ''))) === 'heic');
  check('exotic bytes + heic MIME → heic (lenient)', (await detectFileFormat(mkFile(EXOTIC_BYTES, '', 'image/heic'))) === 'heic');
  check('no signals at all → null', (await detectFileFormat(mkFile(EXOTIC_BYTES, 'blob', ''))) === null);

  console.log('\n══ 9. Batch behaviour (multi-file compressor pick) ══');
  {
    const batch = [
      mkFile(JPEG_EXIF, 'IMG_1234.HEIC', 'image/heic'), // iOS transcode
      mkFile(PNG_BYTES, 'image:52', ''),                 // Android picker, no ext
      mkFile(JPEG_BYTES, '', ''),                        // nameless
      mkFile(WEBP_BYTES, 'shot.webp', 'image/webp'),     // already correct
    ];
    const res = await validateFiles(batch, compressorRule);
    check('mixed gallery batch accepted', res.valid, `errorKey=${res.errorKey}`);
    if (res.valid) {
      const names = res.files!.map((f) => `${f.name}|${f.type}`);
      check(
        'batch normalised correctly',
        names[0] === 'IMG_1234.jpg|image/jpeg' &&
          names[1] === 'image_52.png|image/png' &&
          names[2] === 'image.jpg|image/jpeg' &&
          names[3] === 'shot.webp|image/webp',
        `got ${JSON.stringify(names)}`,
      );
      check('batch byte content preserved', res.files![0].size === batch[0].size && res.files![3] === batch[3]);
      // re-validating already-normalised files must stay valid (uploader re-checks the whole list)
      const res2 = await validateFiles(res.files!, compressorRule);
      check('re-validation of normalised batch passes', res2.valid);
      check('re-validation keeps references stable', res2.files![1] === res.files![1]);
    }
  }

  console.log(`\n${'═'.repeat(60)}\nRESULT: ${passes} passed, ${failures} failed\n${'═'.repeat(60)}`);
  process.exit(failures ? 1 : 0);
}

void main();
