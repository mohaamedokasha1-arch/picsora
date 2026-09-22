'use client';

import * as React from 'react';
import { Presentation } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/utils';
import { convertPptToPdf, type PptToPdfResult } from '@/lib/office-processing/ppt-to-pdf';
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
      <Presentation className="mb-4 h-12 w-12 text-primary" />
      <p className="font-medium text-foreground">Drop PowerPoint file here</p>
      <p className="mt-1 text-sm text-muted-foreground">PPT, PPTX — text extraction. Click to browse.</p>
      <input ref={inputRef} type="file" accept=".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint" className="sr-only" onChange={(e) => { if (e.target.files) handle(e.target.files); e.target.value=''; }} />
    </div>
  );
}

export default function PowerpointToPdfTool() {
  const t = useTranslations();
  const [file, setFile] = React.useState<File | null>(null);
  const [result, setResult] = React.useState<PptToPdfResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = () => { setFile(null); setResult(null); setError(null); };

  const convert = async () => {
    if (!file) return;
    setBusy(true); setError(null); setResult(null);
    try {
      const res = await convertPptToPdf(file);
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
            <Presentation className="h-5 w-5 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{file.name}</span>
          </div>
          <div className="mt-4"><ActionButton onClick={convert} disabled={busy} processing={busy} success={!!result}>Convert to PDF</ActionButton></div>
        </ToolPanel>
      )}
      {result && (
        <>
          <StatGrid columns={3} items={[
            { label: 'Slides', value: String(result.slides) },
            { label: 'Size', value: formatBytes(result.blob.size) },
            { label: 'Format', value: 'PDF' },
          ]} />
          <ToolPanel title="Result">
            <DownloadButton blob={result.blob} filename={result.filename} />
            <p className="mt-3 text-xs text-muted-foreground">Valid PDF generated locally via JSZip XML parsing + pdf-lib. One PDF page per slide, text only. PPTX fully supported; PPT legacy best-effort with warning to convert to PPTX. No images/charts/animations preserved — honest text extraction.</p>
          </ToolPanel>
        </>
      )}
      {!file && (
        <>
          <Notice>PowerPoint to PDF extracts text from PPTX (ZIP + XML) locally via JSZip, then creates PDF pages with pdf-lib. PPTX recommended; PPT legacy has limited support — save as PPTX for best results.</Notice>
          <PrivacyNotice />
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h3 className="font-semibold">Limits</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Input: .pptx (recommended), .ppt (best-effort) up to {MAX_MB} MB</li>
              <li>Output: Valid PDF, one page per slide, searchable text</li>
              <li>Does NOT preserve: images, charts, SmartArt, animations, transitions, speaker notes, master layouts</li>
              <li>PPT legacy: binary format cannot be reliably parsed client-side; we extract printable strings and warn user</li>
              <li>For pixel-perfect, use PowerPoint: File → Export → PDF</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
