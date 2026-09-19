'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import {
  EMPTY_PDF_METADATA,
  readPdfMetadata,
  writePdfMetadata,
  type PdfMetadataFields,
} from '@/lib/pdf-processing/metadata';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;
const FIELDS: (keyof PdfMetadataFields)[] = ['title', 'author', 'subject', 'keywords', 'creator', 'producer'];

/** Strip identifying document properties (author, title, software…) from a PDF. */
export default function PdfMetadataCleanerTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [fields, setFields] = React.useState<PdfMetadataFields | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const loadFile = React.useCallback(
    async (files: File[]) => {
      const next = files[0];
      if (!next) return;
      setLoading(true);
      setResult(null);
      try {
        await load(files);
        const report = await readPdfMetadata(next);
        setFields(report.fields);
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
    setResult(null);
  };

  const clean = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await writePdfMetadata(file, { ...EMPTY_PDF_METADATA });
      setResult(blob);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const found = fields ? FIELDS.filter((k) => fields[k].trim()) : [];

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
          {fields && !result && (
            <ToolPanel
              title={t('pdfTools.metadataFields')}
              actions={<ResetButton onClick={clear} />}
            >
              {found.length === 0 ? (
                <Notice variant="info">{t('pdfTools.metadataCleanerNone')}</Notice>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {t('pdfTools.metadataCleanerFound', { count: found.length })}
                  </p>
                  <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                    {found.map((key) => (
                      <li key={key} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:gap-3">
                        <span className="shrink-0 font-medium text-muted-foreground sm:w-32">
                          {t(`pdfTools.meta_${key}` as never)}
                        </span>
                        <span className="min-w-0 break-words text-foreground">{fields[key]}</span>
                      </li>
                    ))}
                  </ul>
                  <ActionButton onClick={clean} disabled={busy} processing={busy} className="w-full sm:w-auto">
                    {t('pdfTools.metadataCleanerAction')}
                  </ActionButton>
                </div>
              )}
            </ToolPanel>
          )}
          {result && (
            <ToolPanel title={t('pdfTools.metadataReady')}>
              <div className="flex flex-col items-start gap-3">
                <p className="text-sm text-muted-foreground">
                  {formatBytes(result.size)} · {t('pdfTools.pagesCount', { count: info.pageCount })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <DownloadButton
                    blob={result}
                    filename={sanitizeFilename(`${file.name.replace(/\.pdf$/i, '')}-clean.pdf`)}
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
