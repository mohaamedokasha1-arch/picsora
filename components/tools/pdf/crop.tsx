'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Slider } from '@/components/ui/slider';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { cropPdf, type CropMargins } from '@/lib/pdf-processing/crop';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;

/** Crop every page's visible area by margin percentages. */
export default function PdfCropTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [margins, setMargins] = React.useState<CropMargins>({ top: 5, right: 5, bottom: 5, left: 5 });
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const clear = () => {
    reset();
    setResult(null);
  };

  const crop = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const report = await cropPdf(file, margins);
      setResult(report.blob);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof CropMargins) => (value: number) =>
    setMargins((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!file && <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} disabled={busy} />}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clear} />
          {!result && (
            <ToolPanel
              title={t('pdfTools.cropTitle')}
              actions={<ResetButton onClick={clear} />}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Slider label={t('pdfTools.marginTop')} min={0} max={45} value={margins.top} onValueChange={set('top')} valueSuffix="%" disabled={busy} />
                <Slider label={t('pdfTools.marginBottom')} min={0} max={45} value={margins.bottom} onValueChange={set('bottom')} valueSuffix="%" disabled={busy} />
                <Slider label={t('pdfTools.marginLeft')} min={0} max={45} value={margins.left} onValueChange={set('left')} valueSuffix="%" disabled={busy} />
                <Slider label={t('pdfTools.marginRight')} min={0} max={45} value={margins.right} onValueChange={set('right')} valueSuffix="%" disabled={busy} />
              </div>
              <div className="mt-4 space-y-3">
                <Notice variant="info">{t('pdfTools.cropHonesty')}</Notice>
                <ActionButton onClick={crop} disabled={busy} processing={busy} className="w-full sm:w-auto">
                  {t('pdfTools.cropAction')}
                </ActionButton>
              </div>
            </ToolPanel>
          )}
          {result && (
            <ToolPanel title={t('pdfTools.results')}>
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  {formatBytes(result.size)} · {t('pdfTools.pagesCount', { count: info.pageCount })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <DownloadButton
                    blob={result}
                    filename={sanitizeFilename(`${file.name.replace(/\.pdf$/i, '')}-cropped.pdf`)}
                  />
                  <ResetButton onClick={clear} label={t('common.process')} />
                </div>
              </div>
            </ToolPanel>
          )}
        </>
      )}
    </div>
  );
}
