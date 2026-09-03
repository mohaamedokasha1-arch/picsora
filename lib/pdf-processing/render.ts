/**
 * PDF.js page rendering — thumbnails and full-resolution page rasterisation.
 *
 * pdfjs-dist is imported dynamically and its worker is loaded from the local
 * bundle (never a CDN) so nothing is requested from a third party and the
 * library stays out of every non-PDF page's bundle.
 */

import { PdfError } from './index';

type PdfJs = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJs> | null = null;

export async function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjs = await import('pdfjs-dist');
      // The worker is copied into /public by scripts/copy-pdf-worker.mjs and is
      // therefore served from our own origin — never a CDN, and compatible with
      // the `worker-src 'self'` CSP directive.
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
      return pdfjs;
    })();
  }
  return pdfjsPromise;
}

export interface LoadedPdf {
  numPages: number;
  /** Render a page to a data URL at the given CSS pixel width. */
  renderThumb: (pageNumber: number, targetWidth: number) => Promise<string>;
  /** Render a page to a Blob at a given scale factor. */
  renderPage: (
    pageNumber: number,
    scale: number,
    type: 'image/jpeg' | 'image/png',
    quality?: number,
  ) => Promise<{ blob: Blob; width: number; height: number }>;
  destroy: () => Promise<void>;
}

export async function openWithPdfJs(data: Uint8Array, password?: string): Promise<LoadedPdf> {
  const pdfjs = await loadPdfJs();
  let doc;
  try {
    // `data` is transferred/detached by pdf.js, so hand it a copy.
    doc = await pdfjs.getDocument({ data: data.slice(), password, isEvalSupported: false }).promise;
  } catch (error) {
    const name = (error as { name?: string })?.name ?? '';
    if (name === 'PasswordException') throw new PdfError('pdfEncrypted');
    if (name === 'InvalidPDFException') throw new PdfError('invalidPdf');
    throw new PdfError('pdfRenderFailed');
  }

  const canvasFor = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new PdfError('pdfRenderFailed');
    return { canvas, ctx };
  };

  return {
    numPages: doc.numPages,
    async renderThumb(pageNumber, targetWidth) {
      const page = await doc.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const scale = targetWidth / base.width;
      const viewport = page.getViewport({ scale });
      const { canvas, ctx } = canvasFor(viewport.width, viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const url = canvas.toDataURL('image/jpeg', 0.7);
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
      return url;
    },
    async renderPage(pageNumber, scale, type, quality = 0.85) {
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const { canvas, ctx } = canvasFor(viewport.width, viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, type, type === 'image/jpeg' ? quality : undefined),
      );
      const width = canvas.width;
      const height = canvas.height;
      page.cleanup();
      canvas.width = 0;
      canvas.height = 0;
      if (!blob) throw new PdfError('pdfRenderFailed');
      return { blob, width, height };
    },
    async destroy() {
      await doc.destroy();
    },
  };
}

/** DPI presets → PDF.js scale (PDF user space is 72 DPI). */
export function scaleForDpi(dpi: number): number {
  return dpi / 72;
}
