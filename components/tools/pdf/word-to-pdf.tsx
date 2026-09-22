'use client';

import * as React from 'react';
import { FileText, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { convertDocxToPdf, type WordToPdfResult } from '@/lib/office-processing/word-to-pdf';
import {
  InlineError,
  Notice,
  PrivacyNotice,
  ToolPanel,
  ResetButton,
  StatGrid,
} from '../kit';

const MAX_MB = 25;

function OfficeDropzone({
  accept,
  maxFileSizeMB,
  onFile,
  onError,
  disabled,
  label,
}: {
  accept: string;
  maxFileSizeMB: number;
  onFile: (file: File) => void;
  onError: (msg: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const t = useTranslations();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    if (!file.size) {
      onError(t('validation.emptyFile'));
      return;
    }
    if (file.size > maxFileSizeMB * 1024 * 1024) {
      onError(t('validation.fileTooLarge', { size: maxFileSizeMB }));
      return;
    }
    onFile(file);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={`flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 px-6 py-14 text-center transition-all ${dragging ? 'scale-[1.01] border-primary bg-accent/50' : ''} ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:border-primary/50 hover:bg-accent/30'}`}
    >
      <FileText className={`mb-4 h-12 w-12 text-primary ${dragging ? 'scale-110' : ''}`} />
      <p className="text-base font-medium text-foreground">Drop Word file here</p>
      <p className="mt-1 text-sm text-muted-foreground">{label}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-2.5 py-1">Max {maxFileSizeMB} MB</span>
        <span className="rounded-full bg-secondary px-2.5 py-1">DOC, DOCX, TXT</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function WordToPdfTool() {
  const t = useTranslations();
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<WordToPdfResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const convert = async () => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await convertDocxToPdf(file);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error && (e.message === 'outputNoContent' || e.message === 'scannedPdf') ? t(`errors.${e.message}` as never) : (e instanceof Error ? e.message : t('errors.generic')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <OfficeDropzone
          accept=".docx,.doc,.txt,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,text/plain"
          maxFileSizeMB={MAX_MB}
          onFile={(f) => {
            setFile(f);
            setResult(null);
            setError(null);
          }}
          onError={setError}
          disabled={busy}
          label="DOCX best supported — DOC legacy has limited support. Drag & drop or click to browse."
        />
      )}

      {file && (
        <ToolPanel title={`${file.name} · ${formatBytes(file.size)}`} actions={<ResetButton onClick={reset} />}>
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{file.name}</span>
          </div>
          {file.name.toLowerCase().endsWith('.doc') && (
            <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Legacy .DOC format has limited client-side support. For best results, save as .DOCX in Word and retry. We attempt best-effort text extraction.</span>
            </div>
          )}
          <div className="mt-4">
            <ActionButton onClick={convert} disabled={busy} processing={busy} success={!!result}>
              Convert to PDF
            </ActionButton>
          </div>
        </ToolPanel>
      )}

      {result && (
        <>
          <StatGrid
            columns={3}
            items={[
              { label: 'Pages', value: String(result.pages) },
              { label: 'Size', value: formatBytes(result.blob.size) },
              { label: 'Format', value: 'PDF' },
            ]}
          />
          <ToolPanel title="Result">
            <div className="flex flex-wrap items-center gap-3">
              <DownloadButton blob={result.blob} filename={result.filename} />
              <span className="text-sm text-muted-foreground">{result.filename}</span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Honest note: This conversion extracts text and creates a simple PDF. Complex layouts, images, tables, headers/footers and styling are not fully preserved. For pixel-perfect results, use Microsoft Word&apos;s built-in Export to PDF. Your file never left your device — processed locally with mammoth + pdf-lib.
            </p>
          </ToolPanel>
        </>
      )}

      {!file && (
        <>
          <Notice>
            Word to PDF converts DOCX/DOC/TXT to PDF locally in your browser. DOCX is fully supported via mammoth.js text extraction. Legacy .DOC binary format has limited support — please save as DOCX for best fidelity. The PDF is generated with pdf-lib, text-focused, without preserving complex layouts. No upload, private.
          </Notice>
          <PrivacyNotice />
          <div className="rounded-xl border border-border bg-card p-5 text-sm">
            <h3 className="font-semibold text-foreground">Limits & Honest UX</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Input: .docx (recommended), .doc (best-effort), .txt — up to {MAX_MB} MB</li>
              <li>Output: Valid PDF (A4) with wrapped text, not a scanned image</li>
              <li>Does NOT preserve: images, tables, columns, headers/footers, footnotes, tracked changes</li>
              <li>DOC legacy: binary format cannot be reliably parsed client-side without server; we extract readable strings and warn user</li>
              <li>For best fidelity, use Word itself: File → Export → PDF. This tool is for quick text-focused conversion when you need a readable PDF fast and private.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
