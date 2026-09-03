'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/tools/download-button';
import { sanitizeFilename } from '@/lib/utils';
import { pagesToPdf } from '@/lib/pdf-processing';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, usePageThumbnails, useSinglePdf } from './shared';
import { PageGrid } from './page-grid';
import { InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;
const MAX_PAGES = 200;

export default function PdfReorderPagesTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const pageCount = info?.pageCount ?? 0;
  const tooMany = pageCount > MAX_PAGES;
  const { thumbs, rendering, progress, error: renderError } = usePageThumbnails(file, !tooMany, MAX_PAGES);

  const [order, setOrder] = React.useState<number[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  React.useEffect(() => {
    setOrder(Array.from({ length: pageCount }, (_, i) => i));
    setResult(null);
  }, [pageCount]);

  const move = (from: number, to: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setResult(null);
  };

  const changed = order.some((value, index) => value !== index);

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await pagesToPdf(file, order));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    reset();
    setOrder([]);
    setResult(null);
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';

  return (
    <div className="space-y-5">
      <InlineError message={error ?? renderError} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.reorderHint', { max: MAX_PAGES })}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />
          {tooMany && <Notice variant="warning">{t('errors.pdfTooManyPages', { max: MAX_PAGES })}</Notice>}

          {!tooMany && (
            <ToolPanel
              title={t('pdfTools.dragToReorderPages')}
              actions={
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!changed}
                    onClick={() => {
                      setOrder(Array.from({ length: pageCount }, (_, i) => i));
                      setResult(null);
                    }}
                  >
                    {t('pdfTools.resetOrder')}
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
                draggable
                selectable={false}
                tiles={order.map((index, position) => ({
                  index,
                  position: position + 1,
                  thumb: thumbs[index],
                }))}
                onDrop={move}
                labelFor={(tile) => t('pdfTools.pageOriginalLabel', { n: tile.index + 1, position: tile.position })}
                renderFooter={(tile) => (
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] text-muted-foreground">
                      {t('pdfTools.wasPage', { n: tile.index + 1 })}
                    </span>
                    <span className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={tile.position === 1}
                        onClick={() => move(tile.position - 1, tile.position - 2)}
                        aria-label={t('pdfTools.moveUp')}
                      >
                        ←
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={tile.position === pageCount}
                        onClick={() => move(tile.position - 1, tile.position)}
                        aria-label={t('pdfTools.moveDown')}
                      >
                        →
                      </Button>
                    </span>
                  </div>
                )}
              />

              <div className="mt-4">
                <Button onClick={apply} disabled={busy || !changed} loading={busy}>
                  {t('pdfTools.applyOrder')}
                </Button>
              </div>
            </ToolPanel>
          )}
        </>
      )}

      {result && (
        <ToolPanel title={t('toolShell.resultTitle')}>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton blob={result} filename={`${baseName}-reordered.pdf`} />
            <ResetButton onClick={clearAll} />
          </div>
        </ToolPanel>
      )}
    </div>
  );
}
