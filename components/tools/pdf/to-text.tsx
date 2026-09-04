'use client';

import * as React from 'react';
import { FileText, Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { inspect, readBytes } from '@/lib/pdf-processing';
import { extractPdfText, pagesToText } from '@/lib/pdf-processing/text';
import { PdfDropzone, downloadZip, useErrorText } from './shared';
import {
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ProgressBar,
  ResetButton,
  StatGrid,
  ToolPanel,
} from '../kit';

const MAX_FILES = 5;
const MAX_MB = 50;

interface TextResult {
  name: string;
  txtName: string;
  blob: Blob;
  pages: number;
  chars: number;
  preview: string;
}

/** Extract searchable text from PDFs — fully local via pdf.js. */
export default function PdfToTextTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [files, setFiles] = React.useState<File[]>([]);
  const [locked, setLocked] = React.useState<string[]>([]);
  const [results, setResults] = React.useState<TextResult[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });

  const add = async (incoming: File[]) => {
    if (files.length + incoming.length > MAX_FILES) {
      setError(t('validation.tooManyFiles', { max: MAX_FILES }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const names: string[] = [];
      for (const file of incoming) {
        const info = await inspect(file);
        if (info.encrypted) names.push(file.name);
      }
      setLocked((prev) => [...prev, ...names]);
      setFiles((prev) => [...prev, ...incoming]);
      setResults([]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setLocked([]);
    setResults([]);
    setError(null);
    setProgress({ done: 0, total: 0 });
  };

  const extract = async () => {
    if (!files.length || busy) return;
    setBusy(true);
    setError(null);
    setResults([]);
    try {
      const out: TextResult[] = [];
      const total = files.length;
      for (let i = 0; i < total; i += 1) {
        const file = files[i];
        setProgress({ done: i, total });
        if (locked.includes(file.name)) continue;
        const bytes = await readBytes(file);
        const { pages, totalChars } = await extractPdfText(bytes, undefined, () => undefined);
        const text = pagesToText(pages, file.name);
        const base = sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document');
        out.push({
          name: file.name,
          txtName: `${base}.txt`,
          blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
          pages: pages.length,
          chars: totalChars,
          preview: text.slice(0, 900),
        });
        setResults([...out]);
        await new Promise((r) => window.setTimeout(r, 0));
      }
      setProgress({ done: total, total });
      if (!out.length) setError(t('pdfTools.noExtractableText'));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const zipAll = async () => {
    if (!results.length) return;
    setBusy(true);
    try {
      await downloadZip(
        results.map((r) => ({ name: r.txtName, blob: r.blob })),
        'pdf-text.zip',
      );
    } catch {
      setError(t('errors.zipFailed'));
    } finally {
      setBusy(false);
    }
  };

  const totalPages = results.reduce((n, r) => n + r.pages, 0);
  const totalChars = results.reduce((n, r) => n + r.chars, 0);

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {files.length < MAX_FILES && (
        <PdfDropzone
          multiple
          maxFiles={MAX_FILES - files.length}
          maxFileSizeMB={MAX_MB}
          onFiles={add}
          onError={setError}
          disabled={busy}
        />
      )}

      {files.length > 0 && (
        <ToolPanel
          title={t('pdfTools.filesCount', { count: files.length })}
          actions={<ResetButton onClick={reset} />}
        >
          <ul className="space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={f.name}>
                  {f.name} · {formatBytes(f.size)}
                </span>
                {locked.includes(f.name) && (
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" /> {t('pdfTools.encrypted')}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {locked.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">{t('pdfTools.lockedHint')}</p>
          )}
          <div className="mt-4">
            <Button onClick={extract} disabled={busy || !files.length} loading={busy}>
              {t('pdfTools.extractTextAction')}
            </Button>
          </div>
          {busy && <div className="mt-3"><ProgressBar value={progress.done} max={progress.total} label={t('pdfTools.extractingText')} /></div>}
        </ToolPanel>
      )}

      {results.length > 0 && (
        <>
          <StatGrid
            columns={3}
            items={[
              { label: t('pdfTools.filesCount', { count: results.length }), value: String(results.length) },
              { label: t('pdfTools.totalPages'), value: String(totalPages), accent: true },
              { label: t('pdfTools.totalChars'), value: totalChars.toLocaleString() },
            ]}
          />
          <ToolPanel
            title={t('pdfTools.results')}
            actions={
              <>
                <CopyButton value={results.map((r) => r.preview).join('\n\n')} />
                {results.length > 1 && (
                  <Button variant="outline" size="sm" onClick={zipAll} disabled={busy}>
                    {t('common.downloadAll')} (ZIP)
                  </Button>
                )}
              </>
            }
          >
            <div className="space-y-4">
              {results.map((r) => (
                <div key={r.txtName} className="rounded-lg border border-border p-3">
                  <p className="mb-1 truncate text-sm font-medium text-foreground" title={r.name}>
                    {r.name}
                  </p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-secondary/40 p-3 font-mono text-xs leading-relaxed text-muted-foreground">
                    {r.preview}
                    {r.chars > r.preview.length ? '…' : ''}
                  </pre>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <DownloadButton blob={r.blob} filename={r.txtName} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      {t('pdfTools.pagesCount', { count: r.pages })} ·{' '}
                      {t('pdfTools.charsCount', { count: r.chars.toLocaleString() })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ToolPanel>
        </>
      )}

      {!files.length && (
        <>
          <Notice>{t('pdfTools.toTextHint')}</Notice>
          <PrivacyNotice />
        </>
      )}
    </div>
  );
}
