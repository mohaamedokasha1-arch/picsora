'use client';

import * as React from 'react';
import { RotateCcw, RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/tools/download-button';
import { sanitizeFilename } from '@/lib/utils';
import { rotatePdf } from '@/lib/pdf-processing';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, usePageThumbnails, useSinglePdf } from './shared';
import { PageGrid } from './page-grid';
import { InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;

export default function PdfRotatePagesTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const { thumbs, rendering, progress, error: renderError } = usePageThumbnails(file);
  const pageCount = info?.pageCount ?? 0;

  const [rotations, setRotations] = React.useState<number[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  React.useEffect(() => {
    setRotations(Array.from({ length: pageCount }, () => 0));
    setResult(null);
  }, [pageCount]);

  const rotateOne = (index: number, delta: number) => {
    setRotations((prev) => prev.map((value, i) => (i === index ? (((value + delta) % 360) + 360) % 360 : value)));
    setResult(null);
  };

  const rotateAll = (delta: number) => {
    setRotations((prev) => prev.map((value) => (((value + delta) % 360) + 360) % 360));
    setResult(null);
  };

  const changed = rotations.some((value) => value !== 0);

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await rotatePdf(file, rotations));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    reset();
    setRotations([]);
    setResult(null);
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';

  return (
    <div className="space-y-5">
      <InlineError message={error ?? renderError} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.rotateHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel
            title={t('pdfTools.rotatePages')}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => rotateAll(-90)}>
                  <RotateCcw className="h-3.5 w-3.5" /> {t('pdfTools.rotateAllLeft')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => rotateAll(90)}>
                  <RotateCw className="h-3.5 w-3.5" /> {t('pdfTools.rotateAllRight')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => rotateAll(180)}>
                  180°
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
              selectable={false}
              tiles={Array.from({ length: pageCount }, (_, i) => ({
                index: i,
                position: i + 1,
                thumb: thumbs[i],
                rotation: rotations[i] ?? 0,
              }))}
              labelFor={(tile) => t('pdfTools.pageLabel', { n: tile.position })}
              renderFooter={(tile) => (
                <div className="flex items-center justify-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => rotateOne(tile.index, -90)}
                    aria-label={`${t('pdfTools.rotateLeft')} — ${tile.position}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => rotateOne(tile.index, 180)}
                    aria-label={`180° — ${tile.position}`}
                  >
                    <span className="text-[10px] font-semibold">180</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => rotateOne(tile.index, 90)}
                    aria-label={`${t('pdfTools.rotateRight')} — ${tile.position}`}
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            />

            <div className="mt-4">
              <Button onClick={apply} disabled={busy || !changed} loading={busy}>
                {t('pdfTools.applyRotations')}
              </Button>
            </div>
          </ToolPanel>
        </>
      )}

      {result && (
        <ToolPanel title={t('toolShell.resultTitle')}>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton blob={result} filename={`${baseName}-rotated.pdf`} />
            <ResetButton onClick={clearAll} />
          </div>
        </ToolPanel>
      )}
    </div>
  );
}
