'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import {
  EMPTY_PDF_METADATA,
  readPdfMetadata,
  writePdfMetadata,
  type PdfMetadataFields,
} from '@/lib/pdf-processing/metadata';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { Field, InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;
const LIMITS: Record<keyof PdfMetadataFields, number> = {
  title: 200,
  author: 150,
  subject: 300,
  keywords: 300,
  creator: 150,
  producer: 150,
};

export default function PdfMetadataEditorTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [fields, setFields] = React.useState<PdfMetadataFields>({ ...EMPTY_PDF_METADATA });
  const [original, setOriginal] = React.useState<PdfMetadataFields>({ ...EMPTY_PDF_METADATA });
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
        setFields({ ...report.fields });
        setOriginal({ ...report.fields });
      } catch (e) {
        setError(errorText(e));
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [load],
  );

  const clearAll = () => {
    reset();
    setFields({ ...EMPTY_PDF_METADATA });
    setOriginal({ ...EMPTY_PDF_METADATA });
    setResult(null);
  };

  const dirty = (Object.keys(fields) as (keyof PdfMetadataFields)[]).some(
    (key) => fields[key] !== original[key],
  );

  const save = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await writePdfMetadata(file, fields));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const base = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';
  const hasAnyOriginal = (Object.values(original) as string[]).some((value) => value.trim().length > 0);

  const rows: { key: keyof PdfMetadataFields; multiline?: boolean }[] = [
    { key: 'title' },
    { key: 'author' },
    { key: 'subject', multiline: true },
    { key: 'keywords' },
    { key: 'creator' },
    { key: 'producer' },
  ];

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={loadFile} onError={setError} />
          <Notice>{t('pdfTools.metadataHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel
            title={t('pdfTools.metadataFields')}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || loading}
                  onClick={() => setFields({ ...EMPTY_PDF_METADATA })}
                >
                  {t('pdfTools.clearMetadata')}
                </Button>
                <ResetButton onClick={clearAll} />
              </>
            }
          >
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : (
              <div className="space-y-4">
                {rows.map(({ key }) => (
                  <Field key={key} label={t(`pdfTools.meta_${key}` as never)}>
                    <Input
                      value={fields[key]}
                      maxLength={LIMITS[key]}
                      disabled={busy}
                      placeholder={t('pdfTools.metaEmpty')}
                      onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                    />
                  </Field>
                ))}
                {!hasAnyOriginal && (
                  <p className="text-xs text-muted-foreground">{t('pdfTools.metadataNone')}</p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <ActionButton onClick={save} processing={busy} disabled={busy || loading || !dirty}>
                {t('pdfTools.saveMetadata')}
              </ActionButton>
              <span className="text-xs text-muted-foreground">{t('pdfTools.metadataSaveNote')}</span>
            </div>
          </ToolPanel>

          {result && (
            <ToolPanel title={t('pdfTools.metadataReady')}>
              <div className="flex flex-wrap items-center gap-3">
                <DownloadButton blob={result} filename={`${base}-metadata.pdf`} />
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
