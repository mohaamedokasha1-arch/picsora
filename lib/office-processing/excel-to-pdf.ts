'use client';

/**
 * Excel (XLS/XLSX) to PDF — client-side, honest implementation.
 * 
 * Uses SheetJS (xlsx) to parse workbook, then pdf-lib to generate PDF.
 * Each sheet becomes a section in PDF. Table rendering is basic,
 * styling/colors/formulas are not preserved (values only).
 * Multi-sheet support: all sheets included sequentially.
 * 
 * Limitations:
 * - Formulas calculated to values (if xlsx stores calculated values)
 * - No charts, images, pivot tables
 * - Basic grid rendering, column widths auto
 * - Large sheets paginated
 */

import { assertValidOutput } from '@/lib/output-validation';

export interface ExcelToPdfResult {
  blob: Blob;
  filename: string;
  sheets: number;
  totalRows: number;
}

function truncateCell(text: string, maxLen: number = 40): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

export async function convertExcelToPdf(file: File): Promise<ExcelToPdfResult> {
  const XLSXmod: any = await import('xlsx');
  const XLSXLib = XLSXmod.default ?? XLSXmod;
  const { PDFDocument, StandardFonts, rgb } = await import('@cantoo/pdf-lib');

  const arrayBuffer = await file.arrayBuffer();
  let workbook: any;
  try {
    workbook = XLSXLib.read(arrayBuffer, { type: 'array', cellDates: true });
  } catch (e) {
    throw new Error(`Failed to parse Excel file: ${e instanceof Error ? e.message : String(e)}. Ensure it's a valid .xlsx or .xls file.`);
  }

  if (!workbook.SheetNames.length) {
    throw new Error('Excel file contains no sheets.');
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const margin = 30;
  const fontSize = 8;
  const headerFontSize = 10;
  const lineHeight = 12;
  const cellPadding = 2;

  let totalRows = 0;
  let meaningfulCells = 0;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Convert to JSON array of arrays (header: 1 means array of arrays)
    const rows: any[][] = XLSXLib.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false }) as any[][];

    if (!rows.length) continue;
    totalRows += rows.length;
    meaningfulCells += rows.reduce(
      (count, row) => count + row.filter((value) => value !== null && value !== undefined && String(value).trim().length > 0).length,
      0,
    );

    // Calculate column count (max row length)
    const colCount = Math.max(...rows.map(r => r.length), 1);
    const usableWidth = pageWidth - margin * 2;
    const colWidth = usableWidth / colCount;

    // First page for this sheet
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Sheet title
    currentPage.drawText(`Sheet: ${sheetName}`, {
      x: margin,
      y,
      size: 14,
      font: fontBold,
      color: rgb(0, 0, 0),
    });
    y -= 20;

    // Header separator
    currentPage.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 10;

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      
      // Check if need new page
      if (y < margin + 30) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        // Repeat sheet name as header on new page
        currentPage.drawText(`Sheet: ${sheetName} (continued)`, {
          x: margin,
          y,
          size: 10,
          font: fontBold,
          color: rgb(0.4, 0.4, 0.4),
        });
        y -= 16;
      }

      // Draw row background for header row
      if (rowIdx === 0) {
        currentPage.drawRectangle({
          x: margin,
          y: y - cellPadding,
          width: usableWidth,
          height: lineHeight,
          color: rgb(0.9, 0.9, 0.9),
        });
      }

      // Draw cells
      for (let colIdx = 0; colIdx < colCount; colIdx++) {
        const cellValue = row[colIdx];
        let cellText = '';
        if (cellValue === null || cellValue === undefined) cellText = '';
        else if (cellValue instanceof Date) cellText = cellValue.toLocaleDateString();
        else cellText = String(cellValue);

        cellText = truncateCell(cellText, Math.floor(colWidth / (fontSize * 0.55)));

        const x = margin + colIdx * colWidth + cellPadding;
        try {
          currentPage.drawText(cellText, {
            x,
            y,
            size: rowIdx === 0 ? headerFontSize : fontSize,
            font: rowIdx === 0 ? fontBold : font,
            color: rgb(0, 0, 0),
            maxWidth: colWidth - cellPadding * 2,
          });
        } catch {
          const safe = cellText.replace(/[^\x20-\x7E]/g, '?');
          currentPage.drawText(safe, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
          });
        }
      }

      // Draw cell borders (light grid)
      if (rowIdx === 0 || rowIdx === rows.length - 1 || rowIdx % 5 === 0) {
        currentPage.drawLine({
          start: { x: margin, y: y - 2 },
          end: { x: pageWidth - margin, y: y - 2 },
          thickness: 0.3,
          color: rgb(0.85, 0.85, 0.85),
        });
      }

      y -= lineHeight;
    }

    // Space between sheets
    y -= 20;
  }

  if (totalRows === 0 || meaningfulCells === 0) {
    throw new Error('outputNoContent');
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  await assertValidOutput(blob, { format: 'pdf', expectedPageCount: pdfDoc.getPageCount() });
  const baseName = file.name.replace(/\.(xlsx?|xls)$/i, '') || 'spreadsheet';

  return {
    blob,
    filename: `${baseName}.pdf`,
    sheets: workbook.SheetNames.length,
    totalRows,
  };
}
