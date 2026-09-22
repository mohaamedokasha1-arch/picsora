'use client';

/**
 * PowerPoint (PPTX/PPT) to PDF — client-side, honest implementation.
 * 
 * PPTX is a ZIP containing XML slides. We parse via JSZip + DOMParser
 * to extract text content per slide. PPT legacy (.ppt) is binary and
 * not reliably parsable client-side — we document this and suggest
 * converting to PPTX.
 * 
 * PDF generation: pdf-lib, one PDF page per slide with extracted text.
 * Limitations:
 * - No images, charts, animations, transitions, speaker notes
 * - No master layout preservation, text only
 * - PPT (legacy) limited support
 * - Styling minimal
 */

import { assertValidOutput } from '@/lib/output-validation';

export interface PptToPdfResult {
  blob: Blob;
  filename: string;
  slides: number;
}

interface SlideText {
  texts: string[];
}

async function extractPptxSlides(file: File): Promise<SlideText[]> {
  const JSZip = (await import('jszip')).default;
  const arrayBuffer = await file.arrayBuffer();
  let zip: any;
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    throw new Error('Failed to read PPTX file. Ensure it is a valid .pptx file (ZIP-based). Legacy .ppt files have limited support — please save as .pptx in PowerPoint and try again.');
  }

  // Find slide files: ppt/slides/slide*.xml
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml$/)?.[1] || '0', 10);
      return numA - numB;
    });

  if (!slideFiles.length) {
    throw new Error('No slides found in PPTX file. It may be corrupted or in legacy .ppt format. Please save as .pptx and try again.');
  }

  const slides: SlideText[] = [];

  for (const slidePath of slideFiles) {
    const fileData = zip.files[slidePath];
    if (!fileData) continue;
    const xmlText = await fileData.async('string');
    
    // Parse XML to extract <a:t> text nodes (DrawingML text)
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');
    
    // Extract all <a:t> elements which contain actual text
    const textNodes = doc.getElementsByTagName('a:t');
    const texts: string[] = [];
    for (let i = 0; i < textNodes.length; i++) {
      const t = textNodes[i].textContent?.trim();
      if (t) texts.push(t);
    }

    // Also try <a:p> paragraphs for better structure
    if (!texts.length) {
      // Fallback: try to get any text content
      const allText = doc.documentElement.textContent || '';
      const lines = allText.split('\n').map(s => s.trim()).filter(s => s.length > 1 && /[a-zA-Z]{2,}/.test(s));
      texts.push(...lines);
    }

    slides.push({ texts });
  }

  return slides;
}

async function extractPptLegacy(file: File): Promise<SlideText[]> {
  // Best-effort for .ppt: extract printable strings
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let text = '';
  let current = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b >= 32 && b <= 126) {
      current += String.fromCharCode(b);
    } else {
      if (current.length >= 4 && /[a-zA-Z]{2,}/.test(current)) {
        text += current + '\n';
      }
      current = '';
    }
  }
  if (!text.trim()) {
    throw new Error('Legacy .PPT format has very limited client-side support. Please open your presentation in PowerPoint and save as .PPTX (File → Save As → PowerPoint Presentation *.pptx) then try again. The binary .ppt format cannot be reliably parsed in the browser without server processing.');
  }
  // Split into pseudo-slides by double newlines or long gaps
  const chunks = text.split(/\n{2,}/).filter(c => c.trim().length > 10);
  // Group chunks into slides (roughly 5 chunks per slide)
  const slides: SlideText[] = [];
  for (let i = 0; i < chunks.length; i += 5) {
    slides.push({ texts: chunks.slice(i, i + 5) });
  }
  if (!slides.length) slides.push({ texts: [text.slice(0, 2000)] });
  return slides;
}

export async function convertPptToPdf(file: File): Promise<PptToPdfResult> {
  const lower = file.name.toLowerCase();
  const isPptx = lower.endsWith('.pptx');
  const isPpt = lower.endsWith('.ppt');

  if (!isPptx && !isPpt) {
    throw new Error('Unsupported file type. Please upload .pptx or .ppt');
  }

  let slides: SlideText[];
  if (isPptx) {
    slides = await extractPptxSlides(file);
  } else {
    slides = await extractPptLegacy(file);
  }

  if (!slides.length || !slides.some((slide) => slide.texts.some((text) => text.trim().length >= 3))) {
    throw new Error('outputNoContent');
  }

  const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 720; // Wider for slides (10 inch)
  const pageHeight = 405; // 16:9 ratio approx (5.6 inch) — but use A4 landscape for compatibility
  // Actually use A4 landscape: 841.89 x 595.28
  const landscapeWidth = 841.89;
  const landscapeHeight = 595.28;
  const margin = 40;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const page = pdfDoc.addPage([landscapeWidth, landscapeHeight]);
    let y = landscapeHeight - margin;

    // Slide number
    page.drawText(`Slide ${i + 1}`, {
      x: margin,
      y,
      size: 10,
      font: fontBold,
      color: rgb(0.5, 0.5, 0.5),
    });
    y -= 20;

    // Draw texts
    const usableWidth = landscapeWidth - margin * 2;
    const maxCharsPerLine = Math.floor(usableWidth / (11 * 0.6));

    for (const rawText of slide.texts) {
      if (y < margin + 20) break; // Avoid overflow, next slide will have its own content

      // Simple word wrap
      const words = rawText.split(/\s+/);
      let line = '';
      for (const word of words) {
        if ((line + ' ' + word).length > maxCharsPerLine) {
          if (line) {
            try {
              page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0, 0, 0) });
            } catch {
              page.drawText(line.replace(/[^\x20-\x7E]/g, '?'), { x: margin, y, size: 11, font, color: rgb(0, 0, 0) });
            }
            y -= 14;
            if (y < margin + 20) break;
          }
          line = word;
        } else {
          line = line ? line + ' ' + word : word;
        }
      }
      if (line && y >= margin + 20) {
        try {
          page.drawText(line, { x: margin, y, size: 11, font, color: rgb(0, 0, 0) });
        } catch {
          page.drawText(line.replace(/[^\x20-\x7E]/g, '?'), { x: margin, y, size: 11, font, color: rgb(0, 0, 0) });
        }
        y -= 14;
      }
      y -= 6; // Paragraph spacing
    }

    if (!slide.texts.length) {
      page.drawText('(No extractable text on this slide — it may contain only images or charts)', {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0.6, 0.6, 0.6),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  await assertValidOutput(blob, { format: 'pdf', expectedPageCount: pdfDoc.getPageCount() });
  const baseName = file.name.replace(/\.pptx?$/i, '') || 'presentation';

  return {
    blob,
    filename: `${baseName}.pdf`,
    slides: slides.length,
  };
}
