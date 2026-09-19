'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { formatBytes } from '@/lib/utils';
import { readPdfMetadata, type PdfMetadataFields } from '@/lib/pdf-processing/metadata';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { CopyButton, InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;
const FIELDS: (keyof PdfMetadataFields)[] = ['title', 'author', 'subject', 'keywords', 'creator', 'producer'];

/** Read-only inspection of a PDF's document properties — nothing is changed. */
export default function PdfMetadataViewerTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [fields, setFields] = React.useState<PdfMetadataFields | null>(null);
  const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = React.useState(false);

  const loadFile = React.useCallback(
    async (files: File[]) => {
      const next = files[0];
      if (!next) return;
      setLoading(true);
      setFields(null);
      setDims(null);
      try {
        await load(files);
        const report = await readPdfMetadata(next);
        setFields(report.fields);
        if (report.pageWidth && report.pageHeight) {
          setDims({ w: Math.round(report.pageWidth), h: Math.round(report.pageHeight) });
        }
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    [load, setError, errorText],
  );

  const clear = () => {
    reset();
    setFields(null);
    setDims(null);
  };

  const asJson = React.useMemo(() => {
    if (!fields || !info) return '';
    return JSON.stringify(
      {
        file: info.name,
        pages: info.pageCount,
        size: info.size,
        encrypted: info.encrypted,
        firstPagePoints: dims,
        metadata: fields,
      },
      null,
      2,
    );
  }, [fields, info, dims]);

  const emptyCount = fields ? FIELDS.filter((k) => !fields[k].trim()).length : 0;

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!file && (
        <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={loadFile} onError={setError} disabled={loading} />
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clear} />
          {fields && (
            <ToolPanel
              title={t('pdfTools.results')}
              actions={
                <>
                  <CopyButton value={asJson} />
                  <ResetButton onClick={clear} />
                </>
              }
            >
              <dl className="divide-y divide-border text-sm">
                {FIELDS.map((key) => (
                  <div key={key} className="grid gap-1 py-2.5 sm:grid-cols-[160px_1fr] sm:gap-4">
                    <dt className="font-medium text-muted-foreground">{t(`pdfTools.meta_${key}` as never)}</dt>
                    <dd className="break-words text-foreground">
                      {fields[key].trim() || <span className="text-muted-foreground">—</span>}
                    </dd>
                  </div>
                ))}
                <div className="grid gap-1 py-2.5 sm:grid-cols-[160px_1fr] sm:gap-4">
                  <dt className="font-medium text-muted-foreground">{t('pdfTools.pages')}</dt>
                  <dd className="text-foreground">{info.pageCount}</dd>
                </div>
                <div className="grid gap-1 py-2.5 sm:grid-cols-[160px_1fr] sm:gap-4">
                  <dt className="font-medium text-muted-foreground">{t('pdfTools.size')}</dt>
                  <dd className="text-foreground">{formatBytes(info.size)}</dd>
                </div>
                {dims && (
                  <div className="grid gap-1 py-2.5 sm:grid-cols-[160px_1fr] sm:gap-4">
                    <dt className="font-medium text-muted-foreground">{t('pdfTools.pageOriginalLabel')}</dt>
                    <dd className="text-foreground">
                      {dims.w} × {dims.h} pt
                    </dd>
                  </div>
                )}
              </dl>
              {emptyCount === FIELDS.length && (
                <div className="mt-3">
                  <Notice variant="info">{t('pdfTools.metadataViewerEmpty')}</Notice>
                </div>
              )}
            </ToolPanel>
          )}
        </>
      )}
    </div>
  );
}
