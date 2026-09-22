'use client';

import * as React from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/utils';
import { PdfDropzone, useErrorText, useSinglePdf } from './shared';
import { convertPdfToExcel, type PdfToExcelResult } from '@/lib/pdf-processing/pdf-to-excel';
import { InlineError, Notice, PrivacyNotice, ToolPanel, ResetButton, StatGrid, ProgressBar } from '../kit';

const MAX_MB = 50;

export default function PdfToExcelTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const { file, info, error: loadError, setError, loading, load, reset, errorText: _ } = useSinglePdf();
  const [result, setResult] = React.useState<PdfToExcelResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setLocalError] = React.useState<string | null>(null);

  const combinedError = error || loadError;

  const handleFiles = async (files: File[]) => {
    setResult(null);
    setLocalError(null);
    await load(files);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setLocalError(null);
    setResult(null);
    try {
      const res = await convertPdfToExcel(file);
      setResult(res);
    } catch (e) {
      setLocalError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    reset();
    setResult(null);
    setLocalError(null);
  };

  return (
    <div className="space-y-5">
      <InlineError message={combinedError} />

      {!file && (
        <PdfDropzone multiple={false} maxFiles={1} maxFileSizeMB={MAX_MB} onFiles={handleFiles} onError={setError} disabled={busy || loading} />
      )}

      {file && info && (
        <ToolPanel title={`${info.name} · ${formatBytes(info.size)} · ${info.pageCount} pages`} actions={<ResetButton onClick={handleReset} />}>
          <div className="mt-4">
            <ActionButton onClick={convert} disabled={busy || loading} processing={busy} success={!!result}>
              Convert to Excel (.xlsx)
            </ActionButton>
          </div>
        </ToolPanel>
      )}

      {result && (
        <>
          <StatGrid columns={3} items={[
            { label: 'Pages', value: String(result.pages) },
            { label: 'Rows', value: String(result.rows) },
            { label: 'Size', value: formatBytes(result.blob.size) },
          ]} />
          <ToolPanel title="Result — Valid .xlsx">
            <div className="flex flex-wrap items-center gap-3">
              <DownloadButton blob={result.blob} filename={result.filename} />
              <span className="text-sm text-muted-foreground">{result.filename}</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Valid OOXML .xlsx file generated locally via pdf.js text extraction + SheetJS (xlsx). Not a CSV rename — this is a real Excel workbook readable by Excel, Sheets, LibreOffice. Structure: &quot;All Pages&quot; sheet with Page/Line/Text columns plus individual sheets per page (up to 20). Tables may need manual cleanup — complex layouts not perfectly preserved. Your PDF never left your device.
            </p>
          </ToolPanel>
        </>
      )}

      {!file && (
        <>
          <Notice>
            PDF to Excel extracts text lines via pdf.js and creates a valid .xlsx workbook via SheetJS. Each line becomes a row tagged with page number. This is NOT a CSV file renamed to .xlsx — it is genuine OOXML with multiple sheets. Scanned PDFs need OCR first. Private, local.
          </Notice>
          <PrivacyNotice />
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h3 className="font-semibold">Limits & Honest UX</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Input: PDF up to {MAX_MB} MB, text-based only (scanned needs OCR)</li>
              <li>Output: Valid .xlsx (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet), not CSV</li>
              <li>Structure: All Pages sheet (Page, Line, Text) + per-page sheets</li>
              <li>Does NOT perfectly preserve: tables with merged cells, multi-column layouts, images — lines are linear</li>
              <li>For complex tables, you may need to use Text to Columns in Excel after conversion</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
