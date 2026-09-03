import type { DecodedImage, ProcessResult } from '@/lib/types';
import { nameOf } from '@/lib/image/process';

export interface PdfOptions {
  pageSize: 'a4' | 'letter' | 'fit';
  orientation: 'portrait' | 'landscape';
}

const PAGE_PTS: Record<'a4' | 'letter', [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};

function pageDims(opts: PdfOptions): [number, number] {
  if (opts.pageSize === 'fit') return [0, 0];
  const [w, h] = PAGE_PTS[opts.pageSize];
  return opts.orientation === 'landscape' ? [h, w] : [w, h];
}

async function makePdf(files: DecodedImage[], opts: PdfOptions): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();

  for (const decoded of files) {
    const isJpg = decoded.format === 'jpg' || decoded.format === 'jpeg';
    // pdf-lib embeds JPG and PNG natively; re-encode anything else to PNG.
    const bytes = isJpg
      ? await decoded.file.arrayBuffer()
      : await reencodeToPng(decoded);
    const image = isJpg ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);

    let [pw, ph] = pageDims(opts);
    if (opts.pageSize === 'fit') {
      pw = decoded.width;
      ph = decoded.height;
    }
    const page = doc.addPage([pw, ph]);

    const margin = opts.pageSize === 'fit' ? 0 : 36;
    const availW = pw - margin * 2;
    const availH = ph - margin * 2;
    const scale = Math.min(availW / decoded.width, availH / decoded.height, 1);
    const dw = decoded.width * scale;
    const dh = decoded.height * scale;
    const x = (pw - dw) / 2;
    const y = (ph - dh) / 2;
    page.drawImage(image, { x, y, width: dw, height: dh });
  }

  return doc.save();
}

async function reencodeToPng(decoded: DecodedImage): Promise<ArrayBuffer> {
  const { createCanvas } = await import('@/lib/image/process');
  const { canvasToBlob } = await import('@/lib/image/format');
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
  else ctx.drawImage(decoded.image, 0, 0);
  const blob = await canvasToBlob(canvas, { format: 'png' });
  return blob.arrayBuffer();
}

export async function imagesToPdf(
  files: DecodedImage[],
  opts: PdfOptions,
): Promise<ProcessResult> {
  const bytes = await makePdf(files, opts);
  const base = files.length === 1 ? nameOf(files[0].file) : 'images';
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  return { blob, format: 'pdf', name: `${base}.pdf` };
}
