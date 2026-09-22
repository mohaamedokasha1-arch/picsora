'use client';

/**
 * PDF to Excel (.xlsx valid) — client-side, honest implementation.
 * 
 * Extracts text from PDF via pdf.js (existing extractPdfText),
 * then creates a valid OOXML .xlsx workbook using SheetJS.
 * 
 * Structure:
 * - Each PDF page becomes a sheet OR all pages in one sheet with page column
 * - We create both: one sheet "All Pages" with columns: Page, Line, Text
 *   plus individual sheets per page for convenience.
 * - Text is split by lines, preserving order.
 * - No attempt to detect tables perfectly — we provide raw text rows.
 *   User can then use Excel features to split into columns.
 * 
 * This produces a VALID .xlsx file (not CSV renamed), readable by
 * Excel, Google Sheets, LibreOffice.
 * 
 * Limitations documented in UI:
 * - Tables may need manual cleanup
 * - Complex layouts, merged cells not preserved
 * - Scanned PDFs need OCR first
 */

import { extractPdfText } from './text';
import { assertMeaningfulExtractableText, assertValidOutput } from '@/lib/output-validation';

export interface PdfToExcelResult {
  blob: Blob;
  filename: string;
  pages: number;
  rows: number;
}

export async function convertPdfToExcel(file: File): Promise<PdfToExcelResult> {
  const XLSXmod: any = await import('xlsx');
  const XLSX = XLSXmod.default ?? XLSXmod;
  const { readBytes } = await import('./index');

  const bytes = await readBytes(file);
  const { pages } = await extractPdfText(bytes, undefined, () => {});
  assertMeaningfulExtractableText(pages);

  const workbook = XLSX.utils.book_new();

  // Main sheet: All pages with page, line, text columns
  const allRows: any[][] = [['Page', 'Line', 'Text']];
  let totalRows = 0;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageText = pages[pageIdx];
    const lines = pageText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      allRows.push([pageIdx + 1, lineIdx + 1, lines[lineIdx]]);
      totalRows++;
    }
    // Add empty row between pages for readability
    if (pageIdx < pages.length - 1) {
      allRows.push(['', '', '']);
    }
  }

  const allSheet = XLSX.utils.aoa_to_sheet(allRows);
  // Set column widths
  allSheet['!cols'] = [{ wch: 8 }, { wch: 8 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(workbook, allSheet, 'All Pages');

  // Individual sheets per page (up to 20 to avoid Excel sheet limit issues)
  const maxIndividualSheets = Math.min(pages.length, 20);
  for (let i = 0; i < maxIndividualSheets; i++) {
    const pageText = pages[i];
    const lines = pageText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (!lines.length) continue;
    const sheetData = [['Line', 'Text'], ...lines.map((line, idx) => [idx + 1, line])];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    sheet['!cols'] = [{ wch: 8 }, { wch: 80 }];
    // Sheet names must be <=31 chars and not contain invalid chars
    const safeName = `Page ${i + 1}`.slice(0, 31);
    XLSX.utils.book_append_sheet(workbook, sheet, safeName);
  }

  // Generate .xlsx binary
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await assertValidOutput(blob, { format: 'xlsx', minTextLength: 1 });
  const baseName = file.name.replace(/\.pdf$/i, '') || 'document';

  return {
    blob,
    filename: `${baseName}.xlsx`,
    pages: pages.length,
    rows: totalRows,
  };
}
