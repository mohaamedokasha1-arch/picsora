'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { flattenPdf } from '@/lib/pdf-processing/flatten';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;

/** Bake fillable form fields into static page content (locks the values). */
export default function PdfFlattenTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ blob: Blob; fields: number } | null>(null);

  const clear = () => {
    reset();
    setResult(null);
  };

  const flatten = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const report = await flattenPdf(file);
      setResult({ blob: report.blob, fields: report.fields });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!file && <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} disabled={busy} />}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clear} />
          {!result && (
            <ToolPanel title={t('pdfTools.flattenTitle')}>
              <div className="space-y-3">
                <Notice variant="info">{t('pdfTools.flattenHint')}</Notice>
                <ActionButton onClick={flatten} disabled={busy} processing={busy} className="w-full sm:w-auto">
                  {t('pdfTools.flattenAction')}
                </ActionButton>
              </div>
            </ToolPanel>
          )}
          {result && (
            <ToolPanel title={t('pdfTools.results')}>
              <div className="flex flex-col items-start gap-3">
                <Notice variant={result.fields > 0 ? 'privacy' : 'info'}>
                  {result.fields > 0
                    ? t('pdfTools.flattenDone', { count: result.fields })
                    : t('pdfTools.flattenNoFields')}
                </Notice>
                <p className="text-sm text-muted-foreground">
                  {formatBytes(result.blob.size)} · {t('pdfTools.pagesCount', { count: info.pageCount })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <DownloadButton
                    blob={result.blob}
                    filename={sanitizeFilename(`${file.name.replace(/\.pdf$/i, '')}-flat.pdf`)}
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
