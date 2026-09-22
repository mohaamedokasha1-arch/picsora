/** Representative local output-validation checks.
 * Run with: npx tsx scripts/tests/output-validation.test.ts
 */
import { PDFDocument, StandardFonts } from '@cantoo/pdf-lib';
import JSZip from 'jszip';
import XLSX from 'xlsx';
import PptxGenJS from 'pptxgenjs';
import {
  assertMeaningfulExtractableText,
  validateOutput,
} from '@/lib/output-validation';

let failures = 0;
function check(label: string, condition: boolean, detail = '') {
  if (!condition) {
    failures += 1;
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`  ✓ ${label}`);
  }
}

async function validPdf(): Promise<Blob> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([300, 400]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText('Arabic English validation', { x: 20, y: 350, font, size: 12 });
  const bytes = await doc.save();
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
}

async function validXlsx(): Promise<Blob> {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Name', 'Value'], ['Example', 42]]), 'Data');
  return new Blob([XLSX.write(wb, { bookType: 'xlsx', type: 'array' })], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

async function validPptx(): Promise<Blob> {
  const ppt = new PptxGenJS();
  const slide = ppt.addSlide();
  slide.addText('Presentation content', { x: 1, y: 1, w: 5, h: 1 });
  return (await ppt.write({ outputType: 'blob' })) as Blob;
}

async function main() {
  console.log('\n══ output validation: representative outputs ══');
  const pdf = await validPdf();
  const pdfResult = await validateOutput(pdf, { format: 'pdf', expectedPageCount: 1 });
  check('normal English/Arabic text PDF is readable and has one page', pdfResult.valid, JSON.stringify(pdfResult));
  const multiPage = await PDFDocument.create();
  multiPage.addPage([300, 400]);
  multiPage.addPage([300, 400]);
  const multiPageBytes = await multiPage.save();
  const multiPageBlob = new Blob([multiPageBytes.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  check('multi-page PDF page count is validated', (await validateOutput(multiPageBlob, { format: 'pdf', expectedPageCount: 2 })).valid);
  check('wrong PDF page expectation fails', !(await validateOutput(pdf, { format: 'pdf', expectedPageCount: 2 })).valid);
  check('empty output fails', !(await validateOutput(new Blob([], { type: 'application/pdf' }), { format: 'pdf' })).valid);
  check('truncated PDF fails', !(await validateOutput(new Blob(['%PDF-1.7'], { type: 'application/pdf' }), { format: 'pdf' })).valid);

  const xlsx = await validXlsx();
  check('generated Excel workbook is a readable OOXML archive', (await validateOutput(xlsx, { format: 'xlsx' })).valid);
  const pptx = await validPptx();
  check('generated PowerPoint workbook is a readable OOXML archive', (await validateOutput(pptx, { format: 'pptx' })).valid);

  const word = new Blob(['<html><body><p>Transferred document text</p></body></html>'], { type: 'application/msword' });
  check('PDF to Word HTML document has meaningful content', (await validateOutput(word, { format: 'doc', minTextLength: 10 })).valid);
  check('blank Word document fails content validation', !(await validateOutput(new Blob(['<html><body></body></html>']), { format: 'doc', minTextLength: 10 })).valid);

  const zip = new JSZip();
  zip.file('one.txt', 'expected data');
  zip.file('two.csv', 'a,b\n1,2');
  const archive = await zip.generateAsync({ type: 'blob' });
  check('multi-file ZIP contains expected members', (await validateOutput(archive, { format: 'zip', minEntries: 2, expectedFiles: ['one.txt', 'two.csv'] })).valid);
  check('ZIP missing an expected member fails', !(await validateOutput(archive, { format: 'zip', expectedFiles: ['missing.txt'] })).valid);

  // A structurally plausible but truncated PNG must not be marked usable.
  const validPng = Uint8Array.from(Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082', 'hex'));
  check('valid image has usable dimensions and type', (await validateOutput(new Blob([validPng], { type: 'image/png' }), { format: 'png' })).valid);
  const truncatedPng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
  check('truncated image fails', !(await validateOutput(new Blob([truncatedPng], { type: 'image/png' }), { format: 'png' })).valid);
  check('image-only/scanned pages trigger OCR guidance', (() => {
    try {
      assertMeaningfulExtractableText(['', '   ']);
      return false;
    } catch (e) {
      return e instanceof Error && e.message === 'scannedPdf';
    }
  })());
  check('short real text is accepted for a text export', (await validateOutput(new Blob(['42']), { format: 'txt' })).valid);

  console.log(failures ? `\n${failures} OUTPUT VALIDATION FAILURES` : '\nOUTPUT VALIDATION ALL PASS');
  process.exitCode = failures ? 1 : 0;
}

void main();
