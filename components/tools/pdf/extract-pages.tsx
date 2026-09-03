'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DownloadButton } from '@/components/tools/download-button';
import { sanitizeFilename } from '@/lib/utils';
import { pagesToPdf } from '@/lib/pdf-processing';
import { parsePageRanges, summarizeSelection } from '@/lib/pdf-processing/ranges';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, usePageThumbnails, useSinglePdf } from './shared';
import { PageGrid } from './page-grid';
import { Field, InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;

export default function PdfExtractPagesTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const { thumbs, rendering, progress, error: renderError } = usePageThumbnails(file);
  const pageCount = info?.pageCount ?? 0;

  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [rangeText, setRangeText] = React.useState('');
  const [rangeError, setRangeError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const toggle = (index: number) => {
    setResult(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const applyRange = () => {
    const parsed = parsePageRanges(rangeText, pageCount);
    if (parsed.error) {
      setRangeError(t(`errors.${parsed.error}` as never));
      return;
    }
    setRangeError(null);
    setSelected(new Set(parsed.indices));
    setResult(null);
  };

  const extract = async () => {
    if (!file || !selected.size) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await pagesToPdf(file, [...selected].sort((a, b) => a - b)));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    reset();
    setSelected(new Set());
    setRangeText('');
    setRangeError(null);
    setResult(null);
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';

  return (
    <div className="space-y-5">
      <InlineError message={error ?? renderError} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.extractHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel title={t('pdfTools.selectPagesToExtract')} actions={<ResetButton onClick={clearAll} />}>
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <Field label={t('pdfTools.rangeLabel')}>
                  <Input
                    value={rangeText}
                    onChange={(e) => setRangeText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && applyRange()}
                    placeholder={t('pdfTools.rangePlaceholder')}
                    dir="ltr"
                  />
                </Field>
              </div>
              <Button variant="outline" onClick={applyRange} disabled={!rangeText.trim()}>
                {t('pdfTools.applyRange')}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)))}
              >
                {t('pdfTools.selectAll')}
              </Button>
              <Button variant="outline" onClick={() => setSelected(new Set())}>
                {t('pdfTools.deselectAll')}
              </Button>
            </div>
            {rangeError && <p className="mt-2 text-sm text-destructive">{rangeError}</p>}

            <p className="mt-3 text-sm text-muted-foreground">
              {selected.size
                ? t('pdfTools.selectedSummary', { count: selected.size, list: summarizeSelection([...selected]) })
                : t('pdfTools.noPagesSelected')}
            </p>

            <div className="mt-4">
              {rendering && (
                <div className="mb-3">
                  <RenderingIndicator done={progress} total={pageCount} />
                </div>
              )}
              <PageGrid
                tiles={Array.from({ length: pageCount }, (_, i) => ({
                  index: i,
                  position: i + 1,
                  thumb: thumbs[i],
                  selected: selected.has(i),
                }))}
                onToggle={toggle}
                labelFor={(tile) => t('pdfTools.pageLabel', { n: tile.position })}
              />
            </div>

            <div className="mt-4">
              <Button onClick={extract} disabled={!selected.size || busy} loading={busy}>
                {t('pdfTools.extractAction', { count: selected.size })}
              </Button>
            </div>
          </ToolPanel>
        </>
      )}

      {result && (
        <ToolPanel title={t('toolShell.resultTitle')}>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton blob={result} filename={`${baseName}-extracted.pdf`} />
            <ResetButton onClick={clearAll} />
          </div>
        </ToolPanel>
      )}
    </div>
  );
}
