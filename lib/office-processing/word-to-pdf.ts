'use client';

/**
 * Word (DOCX/DOC) to PDF — client-side, honest implementation.
 * 
 * DOCX: parsed via mammoth (extracts raw text + paragraphs).
 * DOC legacy: not supported by mammoth; we attempt best-effort text extraction
 * and warn user to convert to DOCX for better fidelity.
 * 
 * PDF generation: pdf-lib, creates pages with wrapped text.
 * Limitations: layout, images, tables, headers/footers, complex styling
 * are not preserved. This is text-focused conversion, suitable for
 * simple documents, letters, reports. For pixel-perfect fidelity,
 * use Microsoft Word itself.
 */

import { formatBytes } from '@/lib/utils';

export interface WordToPdfResult {
  blob: Blob;
  filename: string;
  pages: number;
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);
  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    let current = '';
    const words = para.split(/\s+/);
    for (const word of words) {
      if ((current + ' ' + word).trim().length > maxCharsPerLine) {
        if (current) lines.push(current.trim());
        // If single word longer than max, split it
        if (word.length > maxCharsPerLine) {
          let idx = 0;
          while (idx < word.length) {
            lines.push(word.slice(idx, idx + maxCharsPerLine));
            idx += maxCharsPerLine;
          }
          current = '';
        } else {
          current = word;
        }
      } else {
        current = current ? current + ' ' + word : word;
      }
    }
    if (current) lines.push(current.trim());
  }
  return lines;
}

export async function convertDocxToPdf(file: File): Promise<WordToPdfResult> {
  const isDocx = file.name.toLowerCase().endsWith('.docx');
  const isDoc = file.name.toLowerCase().endsWith('.doc');
  const isTxt = file.name.toLowerCase().endsWith('.txt');

  let rawText = '';

  if (isTxt) {
    rawText = await file.text();
  } else if (isDocx) {
    // Dynamic import mammoth to keep bundle small
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      rawText = result.value;
      if (!rawText.trim()) {
        // Fallback to HTML then strip tags for better coverage
        const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
        const tmp = document.createElement('div');
        tmp.innerHTML = htmlResult.value;
        rawText = tmp.innerText || tmp.textContent || '';
      }
    } catch (e) {
      throw new Error(`Failed to parse DOCX: ${e instanceof Error ? e.message : String(e)}`);
    }
  } else if (isDoc) {
    // DOC legacy: mammoth doesn't support .doc
    // Attempt to extract readable text strings from binary
    // This is best-effort and will lose formatting
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    // Very naive: extract printable ASCII sequences
    // Real .doc parsing needs antiword or similar, not feasible client-side
    // We look for text between 0x00 or control chars
    let text = '';
    let currentWord = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      // Printable ASCII range + extended latin
      if ((b >= 32 && b <= 126) || b >= 160) {
        currentWord += String.fromCharCode(b);
      } else {
        if (currentWord.length >= 3) {
          // Filter out obvious binary garbage
          if (/[a-zA-Z]{2,}/.test(currentWord)) {
            text += currentWord + ' ';
          }
        }
        currentWord = '';
        if (b === 13 || b === 10) text += '\n';
      }
    }
    rawText = text;
    if (!rawText.trim() || rawText.length < 20) {
      throw new Error('Legacy .DOC format has limited client-side support. Please save your document as .DOCX in Word (File → Save As → DOCX) and try again for best results. The .DOC binary format cannot be reliably parsed in the browser without server processing.');
    }
  } else {
    throw new Error('Unsupported file type. Please upload .docx, .doc or .txt');
  }

  if (!rawText.trim()) {
    throw new Error('No extractable text found in document. It may be scanned images or empty. For scanned documents, use OCR tools first.');
  }

  // Generate PDF via pdf-lib
  const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4 width in points
  const pageHeight = 841.89; // A4 height
  const margin = 50;
  const usableWidth = pageWidth - margin * 2;
  const fontSize = 11;
  const lineHeight = 14;
  const maxCharsPerLine = Math.floor(usableWidth / (fontSize * 0.6)); // approximate

  const wrappedLines = wrapText(rawText, maxCharsPerLine);

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  // Title
  const title = file.name.replace(/\.(docx?|txt)$/i, '');
  currentPage.drawText(title.slice(0, 80), {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0, 0, 0),
  });
  y -= 24;

  for (const line of wrappedLines) {
    if (y < margin + 20) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
    if (!line.trim()) {
      y -= lineHeight / 2;
      continue;
    }
    try {
      currentPage.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: usableWidth,
      });
    } catch {
      // If text contains unsupported chars, skip or replace
      const safe = line.replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
      currentPage.drawText(safe, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: usableWidth,
      });
    }
    y -= lineHeight;
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const baseName = file.name.replace(/\.(docx?|txt)$/i, '') || 'document';
  return {
    blob,
    filename: `${baseName}.pdf`,
    pages: pdfDoc.getPageCount(),
  };
}
