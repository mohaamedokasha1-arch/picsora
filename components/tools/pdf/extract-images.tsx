'use client';

import * as React from 'react';
import { ImageIcon, Package } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { readBytes } from '@/lib/pdf-processing';
import { extractPdfImages, type ExtractedPdfImage } from '@/lib/pdf-processing/images';
import { PdfDropzone, PdfInfoCard, downloadZip, useSinglePdf } from './shared';
import { InlineError, Notice, PrivacyNotice, ProgressBar, ResetButton, StatGrid, ToolPanel } from '../kit';

const MAX_MB = 50;
const MAX_PAGES = 200;

function Thumb({ image }: { image: ExtractedPdfImage }) {
  const url = React.useMemo(() => URL.createObjectURL(image.blob), [image.blob]);
  React.useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={image.name}
      loading="lazy"
      className="h-full w-full object-contain"
      onError={(e) => {
        e.currentTarget.style.visibility = 'hidden';
      }}
    />
  );
}

export default function PdfExtractImagesTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [images, setImages] = React.useState<ExtractedPdfImage[]>([]);
  const [skipped, setSkipped] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [zipping, setZipping] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [done, setDone] = React.useState(false);

  const clearAll = () => {
    reset();
    setImages([]);
    setSkipped(0);
    setDone(false);
    setProgress({ done: 0, total: 0 });
  };

  const extract = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setImages([]);
    setSkipped(0);
    setDone(false);
    try {
      const bytes = await readBytes(file);
      const result = await extractPdfImages(bytes, (doneCount, total) =>
        setProgress({ done: doneCount, total }),
      );
      setImages(result.images);
      setSkipped(result.skipped);
      setDone(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = async () => {
    if (!images.length) return;
    setZipping(true);
    try {
      const base = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';
      await downloadZip(
        images.map((image) => ({ name: image.name, blob: image.blob })),
        `${base}-images.zip`,
      );
    } catch {
      setError(errorText(new Error('zipFailed')));
    } finally {
      setZipping(false);
    }
  };

  const tooManyPages = (info?.pageCount ?? 0) > MAX_PAGES;
  const totalSize = images.reduce((sum, image) => sum + image.sizeBytes, 0);

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.extractImagesHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel title={t('pdfTools.extractImagesTitle')} actions={<ResetButton onClick={clearAll} />}>
            {tooManyPages && (
              <Notice variant="warning">{t('errors.pdfTooManyPages', { max: MAX_PAGES })}</Notice>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <ActionButton onClick={extract} processing={busy} success={done && images.length > 0 && !busy} disabled={busy || tooManyPages}>
                {t('pdfTools.extractImagesAction')}
              </ActionButton>
              {done && images.length > 0 && (
                <Button variant="outline" onClick={downloadAll} loading={zipping} disabled={zipping}>
                  <Package className="h-4 w-4" />
                  {t('pdfTools.downloadAllImages')}
                </Button>
              )}
            </div>
            {busy && progress.total > 0 && (
              <div className="mt-3">
                <ProgressBar
                  value={progress.done}
                  max={progress.total}
                  label={t('pdfTools.scanningObjects', { done: progress.done, total: progress.total })}
                />
              </div>
            )}
          </ToolPanel>

          {done && (
            <>
              <StatGrid
                columns={3}
                items={[
                  { label: t('pdfTools.imagesFound'), value: String(images.length), accent: true },
                  { label: t('pdfTools.imagesSize'), value: formatBytes(totalSize) },
                  { label: t('pdfTools.imagesSkipped'), value: String(skipped) },
                ]}
              />

              {images.length === 0 ? (
                <Notice variant="warning">{t('pdfTools.noImagesFound')}</Notice>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((image) => (
                    <div key={image.id} className="overflow-hidden rounded-xl border border-border bg-card">
                      <div className="flex aspect-video items-center justify-center bg-secondary/40 p-2">
                        <Thumb image={image} />
                      </div>
                      <div className="space-y-2 p-3">
                        <p className="truncate text-xs text-muted-foreground" title={image.name}>
                          {image.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {image.width} × {image.height} px · {formatBytes(image.sizeBytes)} ·{' '}
                          {image.mime === 'image/jpeg' ? 'JPEG' : 'PNG'}
                        </p>
                        <DownloadButton blob={image.blob} filename={image.name} size="sm" className="w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {skipped > 0 && (
                <Notice variant="warning">
                  <span className="flex items-start gap-2">
                    <ImageIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t('pdfTools.imagesSkippedNote', { count: skipped })}</span>
                  </span>
                </Notice>
              )}
            </>
          )}

          {!done && !busy && <Notice>{t('pdfTools.extractImagesTypes')}</Notice>}
        </>
      )}
    </div>
  );
}
