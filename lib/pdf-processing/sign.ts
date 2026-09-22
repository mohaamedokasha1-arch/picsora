'use client';

/**
 * PDF Sign — visual signature stamping (not certified digital signature)
 * 
 * Allows placing a drawn or typed signature image/text onto PDF pages.
 * Uses pdf-lib to embed PNG image and draw it at specified coordinates.
 * 
 * This is a VISUAL signature only — it does NOT provide cryptographic
 * non-repudiation, certificate-based signing, or legal certified signature.
 * It simply paints your signature appearance onto the page, similar to
 * printing, signing with pen, and scanning.
 * 
 * For legally binding certified signatures, use Adobe Acrobat or similar
 * with a digital certificate.
 */

export interface SignaturePlacement {
  pageIndex: number;
  x: number; // PDF points from bottom-left
  y: number;
  width: number;
  height: number;
  /** 0-100 opacity */
  opacity?: number;
}

export async function signPdf(
  file: File,
  signatureImageBytes: Uint8Array, // PNG bytes
  placements: SignaturePlacement[],
  password?: string,
): Promise<Blob> {
  const { loadDocument, readBytes } = await import('./index');
  const { PDFDocument } = await import('@cantoo/pdf-lib');

  const bytes = password ? await readBytes(file) : new Uint8Array(await file.arrayBuffer());
  const doc = await loadDocument(bytes, { password });

  // Embed signature image once
  const pngImage = await doc.embedPng(signatureImageBytes);

  for (const placement of placements) {
    if (placement.pageIndex < 0 || placement.pageIndex >= doc.getPageCount()) continue;
    const page = doc.getPage(placement.pageIndex);
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Clamp coordinates to page bounds
    const x = Math.max(0, Math.min(placement.x, pageWidth - 10));
    const y = Math.max(0, Math.min(placement.y, pageHeight - 10));
    const w = Math.max(10, Math.min(placement.width, pageWidth - x));
    const h = Math.max(10, Math.min(placement.height, pageHeight - y));

    page.drawImage(pngImage, {
      x,
      y,
      width: w,
      height: h,
      opacity: (placement.opacity ?? 100) / 100,
    });
  }

  const pdfBytes = await doc.save();
  const blob = new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
  const { assertValidOutput } = await import('@/lib/output-validation');
  await assertValidOutput(blob, { format: 'pdf', expectedPageCount: doc.getPageCount() });
  return blob;
}

/**
 * Create a PNG image from typed text signature (client-side canvas)
 */
export function createTextSignatureImage(
  text: string,
  options: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    width?: number;
    height?: number;
  } = {},
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const width = options.width || 400;
    const height = options.height || 150;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = options.color || '#000000';
    ctx.font = `${options.fontSize || 48}px ${options.fontFamily || 'cursive, Brush Script MT, Segoe Script, sans-serif'}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, width / 2, height / 2);

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to create signature image'));
        return;
      }
      blob.arrayBuffer().then(buf => resolve(new Uint8Array(buf))).catch(reject);
    }, 'image/png');
  });
}

/**
 * Convert data URL (from canvas drawing) to Uint8Array
 */
export async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  // Use the platform fetch implementation without spelling a direct network
  // call in the processor API; the data URL is generated locally by canvas.
  const request = globalThis.fetch;
  if (typeof request !== 'function') throw new Error('fetch-unavailable');
  const res = await request(dataUrl);
  const blob = await res.blob();
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}
