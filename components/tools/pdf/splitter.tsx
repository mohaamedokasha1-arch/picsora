'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { splitPdf } from '@/lib/pdf-processing';
import { chunkPages, everyPage, parsePageRanges } from '@/lib/pdf-processing/ranges';
import { PdfDropzone, PdfInfoCard, downloadZip, useSinglePdf } from './shared';
import { Field, InlineError, Notice, PrivacyNotice, ProgressBar, ResetButton, ToggleGroup, ToolPanel } from '../kit';

type Mode = 'all' | 'ranges' | 'every';

const MAX_MB = 100;
const MAX_PAGES = 500;

export default function PdfSplitterTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [mode, setMode] = React.useState<Mode>('all');
  const [ranges, setRanges] = React.useState('');
  const [chunkSize, setChunkSize] = React.useState(2);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [results, setResults] = React.useState<{ label: string; blob: Blob }[]>([]);

  const pageCount = info?.pageCount ?? 0;

  const plan = React.useMemo(() => {
    if (!pageCount) return { parts: [] as { label: string; indices: number[] }[], error: null as string | null };
    if (mode === 'all') return { parts: everyPage(pageCount), error: null };
    if (mode === 'every') {
      if (!(chunkSize >= 1)) return { parts: [], error: t('errors.invalidNumberInput') };
      return { parts: chunkPages(pageCount, Math.floor(chunkSize)), error: null };
    }
    const parsed = parsePageRanges(ranges, pageCount);
    if (parsed.error) return { parts: [], error: ranges.trim() ? t(`errors.${parsed.error}` as never) : null };
    return { parts: parsed.groups, error: null };
  }, [mode, ranges, chunkSize, pageCount, t]);

  const tooManyPages = pageCount > MAX_PAGES;

  const run = async () => {
    if (!file || !plan.parts.length) return;
    setBusy(true);
    setError(null);
    setResults([]);
    setProgress({ done: 0, total: plan.parts.length });
    try {
      const out = await splitPdf(
        file,
        plan.parts.map((part) => ({ label: part.label, pageIndices: part.indices })),
        (done, total) => setProgress({ done, total }),
      );
      setResults(out);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    reset();
    setResults([]);
    setRanges('');
    setMode('all');
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.splitterHint', { pages: MAX_PAGES, size: MAX_MB })}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />
          {tooManyPages && <Notice variant="warning">{t('errors.pdfTooManyPages', { max: MAX_PAGES })}</Notice>}

          <ToolPanel title={t('pdfTools.splitMode')} actions={<ResetButton onClick={clearAll} />}>
            <ToggleGroup
              value={mode}
              onChange={(value) => {
                setMode(value);
                setResults([]);
              }}
              options={[
                { value: 'all', label: t('pdfTools.splitAll') },
                { value: 'ranges', label: t('pdfTools.splitRanges') },
                { value: 'every', label: t('pdfTools.splitEvery') },
              ]}
            />

            {mode === 'ranges' && (
              <div className="mt-4">
                <Field label={t('pdfTools.rangeLabel')}>
                  <Input
                    value={ranges}
                    onChange={(e) => {
                      setRanges(e.target.value);
                      setResults([]);
                    }}
                    placeholder={t('pdfTools.rangePlaceholder')}
                    dir="ltr"
                  />
                </Field>
                <p className="mt-1.5 text-xs text-muted-foreground">{t('pdfTools.rangeHint')}</p>
              </div>
            )}

            {mode === 'every' && (
              <div className="mt-4 max-w-[200px]">
                <Field label={t('pdfTools.everyNLabel')}>
                  <Input
                    type="number"
                    min={1}
                    max={Math.max(1, pageCount)}
                    value={chunkSize}
                    onChange={(e) => {
                      setChunkSize(Number(e.target.value));
                      setResults([]);
                    }}
                  />
                </Field>
              </div>
            )}

            {plan.error && <p className="mt-3 text-sm text-destructive">{plan.error}</p>}

            {plan.parts.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-foreground">
                  {t('pdfTools.splitPlan', { count: plan.parts.length })}
                </p>
                <ul className="mt-2 flex max-h-48 flex-wrap gap-2 overflow-y-auto">
                  {plan.parts.slice(0, 60).map((part, i) => (
                    <li
                      key={`${part.label}-${i}`}
                      className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs text-muted-foreground"
                    >
                      {baseName}-{part.label}.pdf
                    </li>
                  ))}
                  {plan.parts.length > 60 && (
                    <li className="px-2.5 py-1 text-xs text-muted-foreground">+{plan.parts.length - 60}…</li>
                  )}
                </ul>
              </div>
            )}

            <div className="mt-4">
              <Button onClick={run} disabled={busy || !plan.parts.length || tooManyPages} loading={busy}>
                {t('pdfTools.splitAction')}
              </Button>
            </div>

            {busy && (
              <div className="mt-4">
                <ProgressBar
                  value={progress.done}
                  max={progress.total}
                  label={t('pdfTools.splittingPart', { done: progress.done, total: progress.total })}
                />
              </div>
            )}
          </ToolPanel>
        </>
      )}

      {results.length > 0 && (
        <ToolPanel
          title={t('toolShell.resultTitle')}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadZip(
                  results.map((r) => ({ name: `${baseName}-${r.label}.pdf`, blob: r.blob })),
                  `${baseName}-split.zip`,
                )
              }
            >
              {t('common.downloadAll')} (ZIP)
            </Button>
          }
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {results.map((result) => (
              <li
                key={result.label}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {baseName}-{result.label}.pdf
                  </p>
                  <p className="text-xs text-muted-foreground">{formatBytes(result.blob.size)}</p>
                </div>
                <DownloadButton blob={result.blob} filename={`${baseName}-${result.label}.pdf`} size="sm" label="" />
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}
    </div>
  );
}
