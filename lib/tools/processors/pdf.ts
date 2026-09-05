import type { DecodedImage, ProcessResult } from '@/lib/types';
import { nameOf } from '@/lib/image/process';
import { canvasToBlob } from '@/lib/image/format';
import { hasAlpha } from '@/lib/image/transparent';

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

/**
 * Draw a decoded image through a canvas and encode it for embedding.
 *
 * Embedding the raw file bytes directly would skip EXIF orientation: a
 * portrait photo taken on a phone would land in the PDF rotated/sideways
 * (its height/width in the layout are the ORIENTED values). Re-encoding from
 * the oriented bitmap keeps every page exactly as the user sees the preview.
 * JPG is kept for opaque sources (smaller files), PNG for anything with alpha.
 */
async function encodeForPdf(decoded: DecodedImage): Promise<{ bytes: ArrayBuffer; kind: 'jpg' | 'png' }> {
  const kind = hasAlpha(decoded) ? 'png' : 'jpg';
  const { createCanvas } = await import('@/lib/image/process');
  const { canvas, ctx } = createCanvas(decoded.width, decoded.height);
  ctx.drawImage((decoded.bitmap ?? decoded.image) as CanvasImageSource, 0, 0);
  const blob = await canvasToBlob(canvas, { format: kind, quality: 0.95 });
  return { bytes: await blob.arrayBuffer(), kind };
}

async function makePdf(files: DecodedImage[], opts: PdfOptions): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();

  for (const decoded of files) {
    const { bytes, kind } = await encodeForPdf(decoded);
    const image =
      kind === 'jpg'
        ? await doc.embedJpg(bytes as unknown as ArrayBuffer)
        : await doc.embedPng(bytes as unknown as ArrayBuffer);

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

export async function imagesToPdf(
  files: DecodedImage[],
  opts: PdfOptions,
): Promise<ProcessResult> {
  const bytes = await makePdf(files, opts);
  const base = files.length === 1 ? nameOf(files[0].file) : 'images';
  const blob = new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  return { blob, format: 'pdf', name: `${base}.pdf` };
}
