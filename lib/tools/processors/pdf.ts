import type { PDFImage } from 'pdf-lib';
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
    //
    // A `.jpg` that pdf-lib refuses to parse (CMYK / progressive / JPEG-2000
    // bodies, which Photoshop and some phones do produce) used to abort the
    // whole job with a raw pdf-lib error. Those cases now fall through to the
    // canvas re-encode, which flattens the picture to PNG and keeps the batch
    // working — the user still gets a PDF containing every page.
    let image: PDFImage;
    if (isJpg) {
      try {
        image = await doc.embedJpg(await decoded.file.arrayBuffer());
      } catch {
        image = await doc.embedPng(await reencodeToPng(decoded));
      }
    } else {
      image = await doc.embedPng(await reencodeToPng(decoded));
    }

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

/**
 * Flatten any image to PNG bytes through the canvas (the universal path for
 * formats pdf-lib cannot embed directly, and for JPEG variants it cannot parse).
 * Failures are labelled with the offending file so a batch error says *which*
 * image was at fault instead of showing the generic panel.
 */
async function reencodeToPng(decoded: DecodedImage): Promise<ArrayBuffer> {
  const { createCanvas } = await import('@/lib/image/process');
  const { canvasToBlob } = await import('@/lib/image/format');
  try {
    const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
    if (decoded.bitmap) ctx.drawImage(decoded.bitmap, 0, 0);
    else ctx.drawImage(decoded.image, 0, 0);
    const blob = await canvasToBlob(canvas, { format: 'png' });
    return await blob.arrayBuffer();
  } catch (error) {
    const err = new Error('pdf-image-failed') as Error & { params?: Record<string, string | number> };
    err.params = { file: decoded.file?.name ?? '' };
    err.cause = error;
    throw err;
  }
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
