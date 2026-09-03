'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { readBytes } from '@/lib/pdf-processing';
import { openWithPdfJs, scaleForDpi } from '@/lib/pdf-processing/render';
import { parsePageRanges } from '@/lib/pdf-processing/ranges';
import { PdfDropzone, PdfInfoCard, downloadZip, useSinglePdf } from './shared';
import { Field, InlineError, Notice, PrivacyNotice, ProgressBar, ResetButton, ToggleGroup, ToolPanel } from '../kit';

type Format = 'jpg' | 'png';
type Dpi = 72 | 150 | 300;

const MAX_MB = 50;
const PAGE_LIMITS: Record<Dpi, number> = { 72: 200, 150: 100, 300: 50 };

interface RenderedPage {
  page: number;
  blob: Blob;
  url: string;
}

export default function PdfToImagesTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [format, setFormat] = React.useState<Format>('jpg');
  const [dpi, setDpi] = React.useState<Dpi>(150);
  const [useRange, setUseRange] = React.useState(false);
  const [rangeText, setRangeText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [pages, setPages] = React.useState<RenderedPage[]>([]);

  const pageCount = info?.pageCount ?? 0;
  const limit = PAGE_LIMITS[dpi];

  const targets = React.useMemo<{ list: number[]; error: string | null }>(() => {
    if (!pageCount) return { list: [], error: null };
    if (!useRange) return { list: Array.from({ length: pageCount }, (_, i) => i), error: null };
    const parsed = parsePageRanges(rangeText, pageCount);
    if (parsed.error) return { list: [], error: rangeText.trim() ? t(`errors.${parsed.error}` as never) : null };
    return { list: parsed.indices, error: null };
  }, [useRange, rangeText, pageCount, t]);

  const overLimit = targets.list.length > limit;

  // Revoke preview URLs when the result set changes or the tool unmounts.
  React.useEffect(() => () => pages.forEach((p) => URL.revokeObjectURL(p.url)), [pages]);

  const convert = async () => {
    if (!file || !targets.list.length) return;
    setBusy(true);
    setError(null);
    setPages((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.url));
      return [];
    });
    setProgress({ done: 0, total: targets.list.length });

    let doc: Awaited<ReturnType<typeof openWithPdfJs>> | null = null;
    try {
      let bytes: Uint8Array | null = await readBytes(file);
      doc = await openWithPdfJs(bytes);
      bytes = null; // free the ArrayBuffer reference
      const scale = scaleForDpi(dpi);
      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const out: RenderedPage[] = [];
      for (let i = 0; i < targets.list.length; i += 1) {
        const pageNumber = targets.list[i] + 1;
        const { blob } = await doc.renderPage(pageNumber, scale, mime, 0.9);
        out.push({ page: pageNumber, blob, url: URL.createObjectURL(blob) });
        setProgress({ done: i + 1, total: targets.list.length });
        // Yield to the event loop so the UI stays responsive.
        await new Promise((resolve) => window.setTimeout(resolve, 0));
      }
      setPages(out);
    } catch (e) {
      setError(errorText(e));
    } finally {
      await doc?.destroy().catch(() => undefined);
      setBusy(false);
    }
  };

  const clearAll = () => {
    reset();
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    setPages([]);
    setRangeText('');
    setUseRange(false);
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';
  const ext = format === 'jpg' ? 'jpg' : 'png';

  return (
    <div className="space-y-5">
      <InlineError message={error ?? targets.error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.toImagesHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel title={t('toolShell.settingsTitle')} actions={<ResetButton onClick={clearAll} />}>
            <div className="grid gap-5 md:grid-cols-2">
              <ToggleGroup
                label={t('pdfTools.outputFormat')}
                value={format}
                onChange={setFormat}
                options={[
                  { value: 'jpg', label: 'JPG' },
                  { value: 'png', label: 'PNG' },
                ]}
              />
              <ToggleGroup
                label={t('pdfTools.resolution')}
                value={String(dpi) as '72' | '150' | '300'}
                onChange={(value) => setDpi(Number(value) as Dpi)}
                options={[
                  { value: '72', label: `72 DPI — ${t('pdfTools.dpiScreen')}` },
                  { value: '150', label: `150 DPI — ${t('pdfTools.dpiMedium')}` },
                  { value: '300', label: `300 DPI — ${t('pdfTools.dpiPrint')}` },
                ]}
              />
            </div>

            <div className="mt-4 space-y-2">
              <ToggleGroup
                label={t('pdfTools.pageSelection')}
                value={useRange ? 'range' : 'all'}
                onChange={(value) => setUseRange(value === 'range')}
                options={[
                  { value: 'all', label: t('pdfTools.allPages') },
                  { value: 'range', label: t('pdfTools.specificRange') },
                ]}
              />
              {useRange && (
                <div className="max-w-sm">
                  <Field label={t('pdfTools.rangeLabel')}>
                    <Input
                      value={rangeText}
                      onChange={(e) => setRangeText(e.target.value)}
                      placeholder={t('pdfTools.rangePlaceholder')}
                      dir="ltr"
                    />
                  </Field>
                </div>
              )}
            </div>

            {overLimit && (
              <div className="mt-3">
                <Notice variant="warning">{t('pdfTools.dpiLimitWarning', { dpi, max: limit })}</Notice>
              </div>
            )}
            {dpi === 300 && pageCount > 20 && !overLimit && (
              <div className="mt-3">
                <Notice variant="warning">{t('pdfTools.highDpiPerformance')}</Notice>
              </div>
            )}

            <div className="mt-4">
              <Button onClick={convert} disabled={busy || overLimit || !targets.list.length} loading={busy}>
                {t('pdfTools.convertToImages')}
              </Button>
            </div>

            {busy && (
              <div className="mt-4">
                <ProgressBar
                  value={progress.done}
                  max={progress.total}
                  label={t('pdfTools.renderingPages', { done: progress.done, total: progress.total })}
                />
              </div>
            )}
          </ToolPanel>
        </>
      )}

      {pages.length > 0 && (
        <ToolPanel
          title={t('toolShell.resultTitle')}
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                downloadZip(
                  pages.map((p) => ({ name: `${baseName}-page-${p.page}.${ext}`, blob: p.blob })),
                  `${baseName}-images.zip`,
                )
              }
            >
              {t('common.downloadAll')} (ZIP)
            </Button>
          }
        >
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {pages.map((page) => (
              <li key={page.page} className="overflow-hidden rounded-lg border border-border bg-card">
                <div className="flex aspect-[3/4] items-center justify-center bg-secondary/40 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={page.url}
                    alt={t('pdfTools.pageLabel', { n: page.page })}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>
                <div className="space-y-2 p-2">
                  <p className="text-xs text-muted-foreground">
                    {t('pdfTools.pageLabel', { n: page.page })} · {formatBytes(page.blob.size)}
                  </p>
                  <DownloadButton
                    blob={page.blob}
                    filename={`${baseName}-page-${page.page}.${ext}`}
                    size="sm"
                    label=""
                    className="w-full"
                  />
                </div>
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}
    </div>
  );
}
