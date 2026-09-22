'use client';

import * as React from 'react';
import { FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/utils';
import { convertExcelToPdf, type ExcelToPdfResult } from '@/lib/office-processing/excel-to-pdf';
import { InlineError, Notice, PrivacyNotice, ToolPanel, ResetButton, StatGrid } from '../kit';

const MAX_MB = 25;

function Dropzone({ onFile, onError, disabled }: { onFile: (f: File) => void; onError: (m: string) => void; disabled?: boolean }) {
  const t = useTranslations();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handle = (files: FileList | File[]) => {
    const f = Array.from(files)[0];
    if (!f) return;
    if (!f.size) { onError(t('validation.emptyFile')); return; }
    if (f.size > MAX_MB * 1024 * 1024) { onError(t('validation.fileTooLarge', { size: MAX_MB })); return; }
    onFile(f);
  };
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) handle(e.dataTransfer.files); }}
      className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 px-6 py-14 text-center ${dragging ? 'border-primary bg-accent/50' : ''} ${disabled ? 'opacity-60' : 'hover:border-primary/50'}`}
    >
      <FileSpreadsheet className="mb-4 h-12 w-12 text-primary" />
      <p className="font-medium text-foreground">Drop Excel file here</p>
      <p className="mt-1 text-sm text-muted-foreground">XLS, XLSX — multi-sheet supported. Click to browse.</p>
      <input ref={inputRef} type="file" accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="sr-only" onChange={(e) => { if (e.target.files) handle(e.target.files); e.target.value=''; }} />
    </div>
  );
}

export default function ExcelToPdfTool() {
  const t = useTranslations();
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<ExcelToPdfResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = () => { setFile(null); setResult(null); setError(null); };

  const convert = async () => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await convertExcelToPdf(file);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error && e.message === 'outputNoContent' ? t('errors.outputNoContent') : (e instanceof Error ? e.message : t('errors.generic')));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <InlineError message={error} />
      {!file && <Dropzone onFile={(f) => { setFile(f); setResult(null); setError(null); }} onError={setError} disabled={busy} />}
      {file && (
        <ToolPanel title={`${file.name} · ${formatBytes(file.size)}`} actions={<ResetButton onClick={reset} />}>
          <div className="flex items-center gap-3 rounded-lg border bg-secondary/30 px-3 py-2">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{file.name}</span>
          </div>
          <div className="mt-4"><ActionButton onClick={convert} disabled={busy} processing={busy} success={!!result}>Convert to PDF</ActionButton></div>
        </ToolPanel>
      )}
      {result && (
        <>
          <StatGrid columns={3} items={[
            { label: 'Sheets', value: String(result.sheets) },
            { label: 'Rows', value: String(result.totalRows) },
            { label: 'Size', value: formatBytes(result.blob.size) },
          ]} />
          <ToolPanel title="Result">
            <DownloadButton blob={result.blob} filename={result.filename} />
            <p className="mt-3 text-xs text-muted-foreground">Valid PDF generated locally via SheetJS + pdf-lib. Basic table grid, values only — no charts/images/formulas preserved. All sheets included sequentially. Multi-sheet Excel fully supported.</p>
          </ToolPanel>
        </>
      )}
      {!file && (
        <>
          <Notice>Excel to PDF parses XLS/XLSX locally via SheetJS, then renders each sheet as PDF pages with pdf-lib. Values only, basic grid. Multi-sheet Excel: all sheets included. No upload.</Notice>
          <PrivacyNotice />
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h3 className="font-semibold">Limits</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Input: .xlsx, .xls up to {MAX_MB} MB, multi-sheet supported</li>
              <li>Output: Valid searchable PDF (A4), not image</li>
              <li>Does NOT preserve: charts, images, pivot tables, conditional formatting, formulas (values only)</li>
              <li>Column widths auto, truncated to 40 chars per cell for readability</li>
              <li>Very large sheets paginated automatically</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
