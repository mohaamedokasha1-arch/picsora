'use client';

import * as React from 'react';
import { GripVertical, X, FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/utils';
import { inspect, mergePdfs, type PdfFileInfo } from '@/lib/pdf-processing';
import { PdfDropzone, useErrorText, downloadZip } from './shared';
import { InlineError, Notice, ProgressBar, ResetButton, StatGrid, ToolPanel, PrivacyNotice } from '../kit';

interface Entry {
  id: string;
  file: File;
  info: PdfFileInfo;
}

const MAX_FILES = 20;
const MAX_FILE_MB = 50;
const MAX_TOTAL_MB = 200;

export default function PdfMergerTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [result, setResult] = React.useState<Blob | null>(null);
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);

  const totalPages = entries.reduce((sum, e) => sum + e.info.pageCount, 0);
  const totalSize = entries.reduce((sum, e) => sum + e.file.size, 0);

  const addFiles = async (files: File[]) => {
    setError(null);
    setResult(null);
    if (entries.length + files.length > MAX_FILES) {
      setError(t('validation.tooManyFiles', { max: MAX_FILES }));
      return;
    }
    const incoming: Entry[] = [];
    for (const file of files) {
      try {
        const info = await inspect(file);
        if (info.encrypted) {
          setError(t('errors.pdfEncryptedFile', { name: file.name }));
          return;
        }
        incoming.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 8)}`, file, info });
      } catch (e) {
        setError(errorText(e));
        return;
      }
    }
    const nextTotal = totalSize + incoming.reduce((s, e) => s + e.file.size, 0);
    if (nextTotal > MAX_TOTAL_MB * 1024 * 1024) {
      setError(t('errors.pdfTotalTooLarge', { size: MAX_TOTAL_MB }));
      return;
    }
    setEntries((prev) => [...prev, ...incoming]);
  };

  const move = (from: number, to: number) => {
    setEntries((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setResult(null);
  };

  const merge = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: totalPages });
    try {
      const blob = await mergePdfs(
        entries.map((e) => e.file),
        (done, total) => setProgress({ done, total }),
      );
      setResult(blob);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setEntries([]);
    setResult(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
  };

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {entries.length < MAX_FILES && (
        <PdfDropzone
          multiple
          maxFiles={MAX_FILES - entries.length}
          maxFileSizeMB={MAX_FILE_MB}
          onFiles={addFiles}
          onError={setError}
          disabled={busy}
        />
      )}

      {entries.length > 0 && (
        <>
          <StatGrid
            columns={3}
            items={[
              { label: t('pdfTools.filesCount'), value: String(entries.length) },
              { label: t('pdfTools.totalPages'), value: String(totalPages) },
              { label: t('pdfTools.estimatedSize'), value: formatBytes(totalSize) },
            ]}
          />

          <ToolPanel title={t('pdfTools.mergeOrder')} actions={<ResetButton onClick={reset} />}>
            <p className="mb-3 text-xs text-muted-foreground">{t('pdfTools.dragToReorder')}</p>
            <ul className="space-y-2">
              {entries.map((entry, index) => (
                <li
                  key={entry.id}
                  draggable={!busy}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex !== null && dragIndex !== index) move(dragIndex, index);
                    setDragIndex(null);
                  }}
                  className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3"
                >
                  <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden="true" />
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground" title={entry.file.name}>
                      {index + 1}. {entry.file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('pdfTools.pagesCount', { count: entry.info.pageCount })} · {formatBytes(entry.file.size)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === 0 || busy}
                      onClick={() => move(index, index - 1)}
                      aria-label={t('pdfTools.moveUp')}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === entries.length - 1 || busy}
                      onClick={() => move(index, index + 1)}
                      aria-label={t('pdfTools.moveDown')}
                    >
                      ↓
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      onClick={() => {
                        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
                        setResult(null);
                      }}
                      aria-label={t('common.close')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button onClick={merge} disabled={entries.length < 2 || busy} loading={busy}>
                {t('pdfTools.mergeAction')}
              </Button>
              {entries.length < 2 && <span className="text-xs text-muted-foreground">{t('errors.pdfNeedTwo')}</span>}
            </div>

            {busy && progress.total > 0 && (
              <div className="mt-4">
                <ProgressBar
                  value={progress.done}
                  max={progress.total}
                  label={t('pdfTools.mergingPage', { done: progress.done, total: progress.total })}
                />
              </div>
            )}
          </ToolPanel>
        </>
      )}

      {result && (
        <ToolPanel title={t('toolShell.resultTitle')}>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton blob={result} filename="merged-document.pdf" />
            <Button
              variant="outline"
              onClick={() => downloadZip([{ name: 'merged-document.pdf', blob: result }], 'merged-pdf.zip')}
            >
              ZIP
            </Button>
            <ResetButton onClick={reset} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {t('pdfTools.mergeDone', { pages: totalPages, size: formatBytes(result.size) })}
          </p>
        </ToolPanel>
      )}

      {!entries.length && (
        <>
          <Notice>{t('pdfTools.mergerHint', { max: MAX_FILES, size: MAX_TOTAL_MB })}</Notice>
          <PrivacyNotice />
        </>
      )}
    </div>
  );
}
