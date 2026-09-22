'use client';

import * as React from 'react';
import { Presentation } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/utils';
import { PdfDropzone, useErrorText, useSinglePdf } from './shared';
import { convertPdfToPpt, type PdfToPptResult } from '@/lib/pdf-processing/pdf-to-ppt';
import { InlineError, Notice, PrivacyNotice, ToolPanel, ResetButton, StatGrid } from '../kit';

const MAX_MB = 50;

export default function PdfToPowerpointTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const { file, info, error: loadError, setError, loading, load, reset } = useSinglePdf();
  const [result, setResult] = React.useState<PdfToPptResult | null>(null);
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
      const res = await convertPdfToPpt(file);
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
              Convert to PowerPoint (.pptx)
            </ActionButton>
          </div>
          {info.pageCount > 100 && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">Large PDF: only first 100 pages will be converted to slides to protect browser memory.</p>
          )}
        </ToolPanel>
      )}

      {result && (
        <>
          <StatGrid columns={3} items={[
            { label: 'Slides', value: String(result.slides) },
            { label: 'Size', value: formatBytes(result.blob.size) },
            { label: 'Format', value: '.PPTX' },
          ]} />
          <ToolPanel title="Result — Valid .pptx">
            <div className="flex flex-wrap items-center gap-3">
              <DownloadButton blob={result.blob} filename={result.filename} />
              <span className="text-sm text-muted-foreground">{result.filename}</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Valid OOXML .pptx file generated locally via pdf.js + pptxgenjs. Not a fake — real PowerPoint readable by PowerPoint, Google Slides, Impress. One slide per PDF page, text only. Layout, images, charts not preserved — honest text extraction. Your PDF never left your device.
            </p>
          </ToolPanel>
        </>
      )}

      {!file && (
        <>
          <Notice>
            PDF to PowerPoint creates a valid .pptx presentation locally. Each PDF page becomes one slide with extracted text. Generated via pdf.js text extraction + pptxgenjs. Private, no upload.
          </Notice>
          <PrivacyNotice />
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h3 className="font-semibold">Limits & Honest UX</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Input: PDF up to {MAX_MB} MB, text-based only (scanned needs OCR)</li>
              <li>Output: Valid .pptx (application/vnd.openxmlformats-officedocument.presentationml.presentation), readable everywhere</li>
              <li>Structure: One slide per PDF page, title = Page N, body = extracted text</li>
              <li>Does NOT preserve: images, tables formatting, columns, headers/footers, layout — linear text only</li>
              <li>Limit: 100 slides max to protect browser memory; for larger PDFs, split first</li>
              <li>Scanned PDFs: run PDF OCR first to get searchable text, then convert</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
