import { PdfError } from './index';
import { loadPdfJs } from './render';

/**
 * Extract searchable text from a PDF entirely in the browser using pdf.js.
 * No bytes leave the device. Scanned (image-only) pages yield empty strings —
 * use the PDF OCR tool for those.
 */
export async function extractPdfText(
  data: Uint8Array,
  password?: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ pages: string[]; totalChars: number }> {
  const pdfjs = await loadPdfJs();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: data.slice(), password, isEvalSupported: false }).promise;
  } catch (error) {
    const name = (error as { name?: string })?.name ?? '';
    if (name === 'PasswordException') throw new PdfError('pdfEncrypted');
    if (name === 'InvalidPDFException') throw new PdfError('invalidPdf');
    throw new PdfError('pdfRenderFailed');
  }

  const pages: string[] = [];
  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
      const page = await doc.getPage(pageNum);
      try {
        const content = await page.getTextContent();
        let text = '';
        for (const item of content.items) {
          const str = (item as { str?: string; hasEOL?: boolean }).str ?? '';
          if (!str) continue;
          // pdf.js splits text into small runs; re-join with spaces and
          // honour explicit end-of-line markers.
          if (text && !text.endsWith(' ') && !text.endsWith('\n')) text += ' ';
          text += str;
          if ((item as { hasEOL?: boolean }).hasEOL) text += '\n';
        }
        pages.push(text.trim());
      } finally {
        page.cleanup();
      }
      onProgress?.(pageNum, doc.numPages);
      // Yield to the UI thread so progress bars stay smooth on long documents.
      if (pageNum % 5 === 0) await new Promise((r) => window.setTimeout(r, 0));
    }
  } finally {
    await doc.destroy().catch(() => undefined);
  }

  return { pages, totalChars: pages.reduce((n, p) => n + p.length, 0) };
}

/** Join extracted pages into a single plain-text document. */
export function pagesToText(pages: string[], fileName: string): string {
  const header = `${fileName}\n${'='.repeat(Math.min(fileName.length, 60))}\n`;
  const body = pages
    .map((text, i) => `\n----- Page ${i + 1} -----\n${text || '(no extractable text on this page)'}`)
    .join('\n');
  return `${header}${body}\n`;
}
