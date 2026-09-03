'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/tools/download-button';
import { sanitizeFilename } from '@/lib/utils';
import { pagesToPdf } from '@/lib/pdf-processing';
import { summarizeSelection } from '@/lib/pdf-processing/ranges';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, usePageThumbnails, useSinglePdf } from './shared';
import { PageGrid } from './page-grid';
import { InlineError, Notice, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

const MAX_MB = 100;

export default function PdfDeletePagesTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const { thumbs, rendering, progress, error: renderError } = usePageThumbnails(file);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [busy, setBusy] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const pageCount = info?.pageCount ?? 0;
  const remaining = pageCount - selected.size;

  const toggle = (index: number) => {
    setResult(null);
    setConfirming(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const apply = async () => {
    if (!file || remaining < 1) return;
    setBusy(true);
    setError(null);
    try {
      const keep = Array.from({ length: pageCount }, (_, i) => i).filter((i) => !selected.has(i));
      setResult(await pagesToPdf(file, keep));
      setConfirming(false);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    reset();
    setSelected(new Set());
    setResult(null);
    setConfirming(false);
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';

  return (
    <div className="space-y-5">
      <InlineError message={error ?? renderError} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.deleteHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <StatGrid
            columns={3}
            items={[
              { label: t('pdfTools.totalPages'), value: String(pageCount) },
              { label: t('pdfTools.selectedForDeletion'), value: String(selected.size), accent: selected.size > 0 },
              { label: t('pdfTools.pagesRemaining'), value: String(remaining) },
            ]}
          />

          {selected.size > pageCount / 2 && selected.size > 0 && (
            <Notice variant="warning">{t('pdfTools.deleteHalfWarning')}</Notice>
          )}
          {remaining < 1 && <Notice variant="warning">{t('errors.pdfCannotDeleteAll')}</Notice>}

          <ToolPanel
            title={t('pdfTools.selectPages')}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelected(new Set(Array.from({ length: pageCount }, (_, i) => i)))}
                >
                  {t('pdfTools.selectAll')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  {t('pdfTools.deselectAll')}
                </Button>
                <ResetButton onClick={clearAll} />
              </>
            }
          >
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

            {selected.size > 0 && (
              <p className="mt-3 text-sm text-muted-foreground">
                {t('pdfTools.selectionSummary', { list: summarizeSelection([...selected]) })}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {!confirming ? (
                <Button
                  variant="destructive"
                  disabled={!selected.size || remaining < 1 || busy}
                  onClick={() => (selected.size > 5 ? setConfirming(true) : apply())}
                >
                  {t('pdfTools.deleteAction', { count: selected.size })}
                </Button>
              ) : (
                <>
                  <span className="text-sm text-foreground">
                    {t('pdfTools.deleteConfirm', { count: selected.size })}
                  </span>
                  <Button variant="destructive" onClick={apply} loading={busy}>
                    {t('common.process')}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirming(false)}>
                    {t('common.cancel')}
                  </Button>
                </>
              )}
            </div>
          </ToolPanel>
        </>
      )}

      {result && (
        <ToolPanel title={t('toolShell.resultTitle')}>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton blob={result} filename={`${baseName}-edited.pdf`} />
            <ResetButton onClick={clearAll} />
          </div>
        </ToolPanel>
      )}
    </div>
  );
}
