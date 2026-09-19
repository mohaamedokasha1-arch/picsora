'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { addHeaderFooter, type HeaderFooterAlign } from '@/lib/pdf-processing/header-footer';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import {
  CheckboxRow,
  Field,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  ToggleGroup,
  ToolPanel,
} from '../kit';

const MAX_MB = 100;

/** Stamp a custom header and/or footer line onto every page. */
export default function PdfHeaderFooterTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [header, setHeader] = React.useState('');
  const [footer, setFooter] = React.useState('Page {page} of {pages}');
  const [align, setAlign] = React.useState<HeaderFooterAlign>('center');
  const [fontSize, setFontSize] = React.useState(10);
  const [startAt, setStartAt] = React.useState(1);
  const [skipFirst, setSkipFirst] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const clear = () => {
    reset();
    setResult(null);
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const report = await addHeaderFooter(file, {
        header,
        footer,
        startAt: Math.max(1, Math.round(startAt) || 1),
        skipFirst,
        fontSize,
        align,
      });
      setResult(report.blob);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const empty = !header.trim() && !footer.trim();

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!file && <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} disabled={busy} />}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clear} />
          {!result && (
            <ToolPanel title={t('pdfTools.hfTitle')} actions={<ResetButton onClick={clear} />}>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label={t('pdfTools.hfHeader')}>
                  <Input
                    value={header}
                    onChange={(e) => setHeader(e.target.value)}
                    placeholder={t('pdfTools.hfHeaderPh')}
                    disabled={busy}
                    maxLength={200}
                  />
                </Field>
                <Field label={t('pdfTools.hfFooter')}>
                  <Input
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                    placeholder={t('pdfTools.hfFooterPh')}
                    disabled={busy}
                    maxLength={200}
                  />
                </Field>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <ToggleGroup<HeaderFooterAlign>
                  label={t('pdfTools.positionLabel')}
                  value={align}
                  onChange={setAlign}
                  options={[
                    { value: 'left', label: t('pdfTools.alignLeft') },
                    { value: 'center', label: t('pdfTools.alignCenter') },
                    { value: 'right', label: t('pdfTools.alignRight') },
                  ]}
                />
                <Slider
                  label={t('pdfTools.hfSize')}
                  min={8}
                  max={24}
                  value={fontSize}
                  onValueChange={setFontSize}
                  disabled={busy}
                />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <Field label={t('pdfTools.startingNumber')}>
                  <Input
                    type="number"
                    min={1}
                    max={99999}
                    value={startAt}
                    onChange={(e) => setStartAt(Number(e.target.value))}
                    disabled={busy}
                    dir="ltr"
                  />
                </Field>
                <Field label={t('pdfTools.hfOptions')}>
                  <CheckboxRow
                    checked={skipFirst}
                    onChange={setSkipFirst}
                    label={t('pdfTools.hfSkipFirst')}
                  />
                </Field>
              </div>
              <div className="mt-4 space-y-3">
                <Notice variant="info">{t('pdfTools.hfPlaceholders')}</Notice>
                {empty && <Notice variant="warning">{t('pdfTools.hfEmpty')}</Notice>}
                <ActionButton onClick={apply} disabled={busy || empty} processing={busy} className="w-full sm:w-auto">
                  {t('pdfTools.hfAction')}
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
                    filename={sanitizeFilename(`${file.name.replace(/\.pdf$/i, '')}-header-footer.pdf`)}
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
