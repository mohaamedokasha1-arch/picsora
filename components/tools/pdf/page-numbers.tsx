'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { loadPdfLib, readBytes } from '@/lib/pdf-processing';
import {
  clampMargin,
  pageNumberLabel,
  pageNumberPlacement,
  PAGE_NUMBER_FORMATS,
  PAGE_NUMBER_POSITIONS,
  type PageNumberFormat,
  type PageNumberPosition,
} from '@/lib/pdf-processing/numbering';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { Field, InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;

export default function PdfPageNumberTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [position, setPosition] = React.useState<PageNumberPosition>('bottom-center');
  const [format, setFormat] = React.useState<PageNumberFormat>('plain');
  const [startAt, setStartAt] = React.useState(1);
  const [fontSize, setFontSize] = React.useState(11);
  const [margin, setMargin] = React.useState(28);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const clearAll = () => {
    reset();
    setResult(null);
  };

  const apply = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
      const bytes = await readBytes(file);
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const pages = doc.getPages();
      const total = pages.length;
      const lastNumber = startAt + total - 1;
      const size = Math.min(48, Math.max(6, fontSize));

      pages.forEach((page, index) => {
        const number = startAt + index;
        const label = pageNumberLabel(format, number, lastNumber);
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, size);
        const safeMargin = clampMargin(margin, height);
        const { x, y } = pageNumberPlacement({
          pageWidth: width,
          pageHeight: height,
          textWidth,
          textHeight: size,
          margin: safeMargin,
          position,
        });
        page.drawText(label, { x, y, size, font, color: rgb(0.15, 0.15, 0.15) });
      });

      const out = await doc.save();
      setResult(new Blob([out.slice().buffer], { type: 'application/pdf' }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const base = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';
  const previewLabel = pageNumberLabel(format, Math.max(1, startAt), Math.max(startAt, startAt + (info?.pageCount ?? 1) - 1));

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.pageNumbersHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel
            title={t('pdfTools.pageNumberSettings')}
            actions={<ResetButton onClick={clearAll} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('pdfTools.positionLabel')}>
                <Select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as PageNumberPosition)}
                  disabled={busy}
                  options={PAGE_NUMBER_POSITIONS.map((value) => ({
                    value,
                    label: t(`pdfTools.pos_${value}` as never),
                  }))}
                />
              </Field>
              <Field label={t('pdfTools.numberFormat')}>
                <Select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as PageNumberFormat)}
                  disabled={busy}
                  options={PAGE_NUMBER_FORMATS.map((value) => ({
                    value,
                    label: t(`pdfTools.fmt_${value}` as never),
                  }))}
                />
              </Field>
              <Field label={t('pdfTools.startingNumber')}>
                <Input
                  type="number"
                  min={0}
                  max={99999}
                  value={startAt}
                  disabled={busy}
                  onChange={(e) => setStartAt(Number(e.target.value))}
                />
              </Field>
              <Field label={`${t('controls.fontSize')} (pt)`}>
                <Input
                  type="number"
                  min={6}
                  max={48}
                  value={fontSize}
                  disabled={busy}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </Field>
              <Field label={`${t('pdfTools.marginLabel')} (pt)`}>
                <Input
                  type="number"
                  min={6}
                  max={200}
                  value={margin}
                  disabled={busy}
                  onChange={(e) => setMargin(Number(e.target.value))}
                />
              </Field>
              <div className="flex items-end">
                <Button onClick={apply} loading={busy} disabled={busy} className="w-full">
                  {t('pdfTools.applyNumbers')}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {t('pdfTools.previewLabel')}: <span className="font-semibold text-foreground">{previewLabel}</span>
            </p>
          </ToolPanel>

          {result && (
            <ToolPanel title={t('pdfTools.pageNumbersReady')}>
              <div className="flex flex-wrap items-center gap-3">
                <DownloadButton blob={result} filename={`${base}-numbered.pdf`} />
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
