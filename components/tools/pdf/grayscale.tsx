'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

import { ActionButton } from '@/components/ui/action-button';
import { Select } from '@/components/ui/select';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { pdfFromJpegPages, readBytes } from '@/lib/pdf-processing';
import { openWithPdfJs } from '@/lib/pdf-processing/render';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { Field, InlineError, Notice, PrivacyNotice, ProgressBar, ResetButton, ToolPanel, ToggleGroup } from '../kit';

const MAX_MB = 50;
const MAX_PAGES = 60;

type Mode = 'grayscale' | 'blackwhite';
type Dpi = '100' | '150' | '200';

export default function PdfGrayscaleTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [mode, setMode] = React.useState<Mode>('grayscale');
  const [dpi, setDpi] = React.useState<Dpi>('150');
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [result, setResult] = React.useState<Blob | null>(null);

  const clearAll = () => {
    reset();
    setResult(null);
    setProgress({ done: 0, total: 0 });
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    const resolution = Number(dpi);
    try {
      let doc: Awaited<ReturnType<typeof openWithPdfJs>> | null = null;
      try {
        let bytes: Uint8Array | null = await readBytes(file);
        doc = await openWithPdfJs(bytes);
        bytes = null;
        const total = doc.numPages;
        setProgress({ done: 0, total });
        const pages: { data: Uint8Array; width: number; height: number }[] = [];
        const scale = resolution / 72;
        // PDF points are 1/72 inch, so a pixel at `resolution` DPI is worth
        // 72/resolution points when the JPEG is placed back on the page.
        const pointsPerPixel = 72 / resolution;

        for (let page = 1; page <= total; page += 1) {
          const { blob, width, height } = await doc.renderPage(page, scale, 'image/jpeg', 0.9);
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('pdfRenderFailed');
          const bitmap = await createImageBitmap(blob);
          ctx.drawImage(bitmap, 0, 0);
          bitmap.close();

          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const value = mode === 'blackwhite' ? (lum >= 128 ? 255 : 0) : lum;
            data[i] = value;
            data[i + 1] = value;
            data[i + 2] = value;
          }
          ctx.putImageData(imageData, 0, 0);

          const outBlob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', 0.85),
          );
          canvas.width = 0;
          canvas.height = 0;
          if (!outBlob) throw new Error('pdfRenderFailed');
          pages.push({
            data: new Uint8Array(await outBlob.arrayBuffer()),
            width: width * pointsPerPixel,
            height: height * pointsPerPixel,
          });
          setProgress({ done: page, total });
          await new Promise((resolve) => window.setTimeout(resolve, 0));
        }

        setResult(await pdfFromJpegPages(pages));
        pages.length = 0;
      } finally {
        await doc?.destroy().catch(() => undefined);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const base = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';
  const tooManyPages = (info?.pageCount ?? 0) > MAX_PAGES;

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.grayscaleHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel title={t('pdfTools.grayscaleSettings')} actions={<ResetButton onClick={clearAll} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <ToggleGroup
                value={mode}
                onChange={(value) => {
                  setMode(value);
                  setResult(null);
                }}
                label={t('pdfTools.grayscaleMode')}
                options={[
                  { value: 'grayscale' as Mode, label: t('pdfTools.modeGrayscale') },
                  { value: 'blackwhite' as Mode, label: t('pdfTools.modeBlackWhite') },
                ]}
              />
              <Field label={t('pdfTools.resolution')}>
                <Select
                  value={dpi}
                  onChange={(e) => setDpi(e.target.value as Dpi)}
                  disabled={busy}
                  options={[
                    { value: '100', label: t('pdfTools.dpiScreen') },
                    { value: '150', label: t('pdfTools.dpiMedium') },
                    { value: '200', label: '200 DPI' },
                  ]}
                />
              </Field>
            </div>

            <Notice variant="warning">{t('pdfTools.rasterNotice')}</Notice>
            {tooManyPages && (
              <Notice variant="warning">{t('errors.pdfTooManyPages', { max: MAX_PAGES })}</Notice>
            )}

            <div className="mt-4 space-y-3">
              <ActionButton onClick={convert}
                processing={busy}
                disabled={busy || tooManyPages}
                className="w-full sm:w-auto"
              >
                {t('pdfTools.convertGrayscale')}
              </ActionButton>
              {busy && progress.total > 0 && (
                <ProgressBar
                  value={progress.done}
                  max={progress.total}
                  label={t('pdfTools.renderingPages', { done: progress.done, total: progress.total })}
                />
              )}
            </div>
          </ToolPanel>

          {result && (
            <ToolPanel title={t('pdfTools.grayscaleReady')}>
              <div className="flex flex-wrap items-center gap-3">
                <DownloadButton blob={result} filename={`${base}-grayscale.pdf`} />
                <span className="text-sm text-muted-foreground">
                  {formatBytes(result.size)} · {t('pdfTools.pagesCount', { count: info.pageCount })}
                </span>
              </div>
            </ToolPanel>
          )}
        </>
      )}
    </div>
  );
}
