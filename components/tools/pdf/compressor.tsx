'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { pdfFromJpegPages, readBytes, recompressPdf } from '@/lib/pdf-processing';
import { openWithPdfJs } from '@/lib/pdf-processing/render';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { InlineError, Notice, PrivacyNotice, ProgressBar, ResetButton, StatGrid, ToggleGroup, ToolPanel } from '../kit';

type Level = 'light' | 'medium' | 'maximum';

const MAX_MB = 100;

export default function PdfCompressorTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [level, setLevel] = React.useState<Level>('medium');
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [result, setResult] = React.useState<Blob | null>(null);

  const compress = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: 0 });
    try {
      if (level !== 'maximum') {
        setResult(await recompressPdf(file, level === 'medium'));
      } else {
        // Maximum: rasterise each page at 110 DPI and rebuild the PDF from
        // JPEGs. This is the only way to shrink image-heavy PDFs in-browser.
        let doc: Awaited<ReturnType<typeof openWithPdfJs>> | null = null;
        try {
          let bytes: Uint8Array | null = await readBytes(file);
          doc = await openWithPdfJs(bytes);
          bytes = null;
          const total = doc.numPages;
          setProgress({ done: 0, total });
          const rendered: { data: Uint8Array; width: number; height: number }[] = [];
          for (let page = 1; page <= total; page += 1) {
            const { blob, width, height } = await doc.renderPage(page, 110 / 72, 'image/jpeg', 0.75);
            rendered.push({ data: new Uint8Array(await blob.arrayBuffer()), width: width * 0.6545, height: height * 0.6545 });
            setProgress({ done: page, total });
            await new Promise((resolve) => window.setTimeout(resolve, 0));
          }
          setResult(await pdfFromJpegPages(rendered));
          rendered.length = 0;
        } finally {
          await doc?.destroy().catch(() => undefined);
        }
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    reset();
    setResult(null);
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';
  const saved = file && result ? ((file.size - result.size) / file.size) * 100 : 0;

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.compressHonesty')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel title={t('pdfTools.compressionLevel')} actions={<ResetButton onClick={clearAll} />}>
            <ToggleGroup
              value={level}
              onChange={(value) => {
                setLevel(value);
                setResult(null);
              }}
              options={[
                { value: 'light', label: t('pdfTools.levelLight') },
                { value: 'medium', label: t('pdfTools.levelMedium') },
                { value: 'maximum', label: t('pdfTools.levelMaximum') },
              ]}
            />
            <p className="mt-3 text-sm text-muted-foreground">{t(`pdfTools.levelDesc_${level}` as never)}</p>

            <div className="mt-4">
              <Button onClick={compress} disabled={busy} loading={busy}>
                {t('pdfTools.compressAction')}
              </Button>
            </div>

            {busy && progress.total > 0 && (
              <div className="mt-4">
                <ProgressBar
                  value={progress.done}
                  max={progress.total}
                  label={t('pdfTools.renderingPages', { done: progress.done, total: progress.total })}
                />
              </div>
            )}
          </ToolPanel>

          <Notice>{t('pdfTools.compressHonesty')}</Notice>
        </>
      )}

      {result && file && (
        <ToolPanel title={t('toolShell.resultTitle')}>
          <StatGrid
            columns={3}
            items={[
              { label: t('toolShell.originalSize'), value: formatBytes(file.size) },
              { label: t('toolShell.newSize'), value: formatBytes(result.size) },
              {
                label: t('pdfTools.reduction'),
                value: `${saved > 0 ? '−' : '+'}${Math.abs(saved).toFixed(1)}%`,
                accent: saved > 0,
              },
            ]}
          />
          {saved <= 0 && (
            <div className="mt-3">
              <Notice variant="warning">{t('pdfTools.noReduction')}</Notice>
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <DownloadButton blob={result} filename={`${baseName}-compressed.pdf`} />
            <ResetButton onClick={clearAll} />
          </div>
        </ToolPanel>
      )}
    </div>
  );
}
