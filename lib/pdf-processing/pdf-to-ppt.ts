'use client';

/**
 * PDF to PowerPoint (.pptx valid) — client-side, honest implementation.
 * 
 * Extracts text from PDF via pdf.js, then creates a valid .pptx
 * presentation using pptxgenjs.
 * 
 * Structure:
 * - One slide per PDF page
 * - Each slide contains extracted text, with page number title
 * - Text is placed in text boxes, preserving line breaks
 * 
 * This produces a VALID .pptx file readable by PowerPoint,
 * Google Slides, LibreOffice Impress.
 * 
 * Limitations:
 * - Layout not preserved, text only
 * - No images, charts, tables formatting
 * - Scanned PDFs need OCR first
 * - Complex multi-column layouts become linear text
 */

import { extractPdfText } from './text';

export interface PdfToPptResult {
  blob: Blob;
  filename: string;
  slides: number;
}

export async function convertPdfToPpt(file: File): Promise<PdfToPptResult> {
  const { readBytes } = await import('./index');
  const mod: any = await import('pptxgenjs');
  const PptxGenJS = mod.default ?? mod;

  const bytes = await readBytes(file);
  const { pages } = await extractPdfText(bytes, undefined, () => {});

  if (!pages.length) {
    throw new Error('No extractable text found. If this is a scanned PDF, try PDF OCR first.');
  }

  const pptx = new PptxGenJS();
  pptx.author = 'Piclizer';
  pptx.title = file.name.replace(/\.pdf$/i, '');

  // Limit to 100 slides to avoid browser memory issues
  const maxSlides = Math.min(pages.length, 100);

  for (let i = 0; i < maxSlides; i++) {
    const pageText = pages[i];
    const slide = pptx.addSlide();
    
    // Title: Page number
    slide.addText(`Page ${i + 1}`, {
      x: 0.5,
      y: 0.2,
      w: 9,
      h: 0.4,
      fontSize: 14,
      bold: true,
      color: '666666',
    });

    // Content: extracted text, truncated to avoid pptxgenjs limits
    // pptxgenjs has issues with very long text, so we chunk
    const lines = pageText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const content = lines.join('\n').slice(0, 5000); // Limit per slide

    if (content) {
      slide.addText(content, {
        x: 0.5,
        y: 0.7,
        w: 9,
        h: 4.5,
        fontSize: 10,
        color: '000000',
        valign: 'top',
        wrap: true,
      });
    } else {
      slide.addText('(No extractable text on this page — it may be scanned images or empty)', {
        x: 0.5,
        y: 1,
        w: 9,
        h: 1,
        fontSize: 10,
        italic: true,
        color: '999999',
      });
    }

    // Footer note about conversion
    slide.addText('Converted from PDF via Piclizer — text only, layout not preserved', {
      x: 0.5,
      y: 5.3,
      w: 9,
      h: 0.2,
      fontSize: 7,
      color: 'AAAAAA',
    });
  }

  // Generate blob
  const blob = await pptx.write({ outputType: 'blob' }) as Blob;
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  return {
    blob: blob as Blob,
    filename: `${baseName}.pptx`,
    slides: maxSlides,
  };
}
