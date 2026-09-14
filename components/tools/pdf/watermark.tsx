'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { loadPdfLib, readBytes } from '@/lib/pdf-processing';
import { WATERMARK_LAYOUTS, watermarkPlacements, type WatermarkLayout } from '@/lib/pdf-processing/watermark';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { Field, InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;
const MAX_TEXT = 120;

export default function PdfWatermarkTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [text, setText] = React.useState('');
  const [layout, setLayout] = React.useState<WatermarkLayout>('diagonal');
  const [opacity, setOpacity] = React.useState(18);
  const [fontSize, setFontSize] = React.useState(48);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const clearAll = () => {
    reset();
    setResult(null);
  };

  const apply = async () => {
    if (!file || !text.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const { PDFDocument, StandardFonts, degrees, rgb } = await loadPdfLib();
      const bytes = await readBytes(file);
      const doc = await PDFDocument.load(bytes, { updateMetadata: false });
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const label = text.trim().slice(0, MAX_TEXT);
      const size = Math.min(240, Math.max(8, fontSize));

      for (const page of doc.getPages()) {
        const { width, height } = page.getSize();
        const textWidth = font.widthOfTextAtSize(label, size);
        const placements = watermarkPlacements({
          pageWidth: width,
          pageHeight: height,
          textWidth,
          fontSize: size,
          layout,
          opacity,
        });
        for (const stamp of placements) {
          page.drawText(label, {
            x: stamp.x,
            y: stamp.y,
            size,
            font,
            color: rgb(0.45, 0.45, 0.45),
            opacity: stamp.opacity,
            rotate: degrees(stamp.rotate),
          });
        }
      }

      if (doc.getPageCount() === 0) throw new Error('pdfNoPages');
      const out = await doc.save();
      setResult(new Blob([out.slice().buffer], { type: 'application/pdf' }));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const base = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <Notice>{t('pdfTools.watermarkHint')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel
            title={t('pdfTools.watermarkSettings')}
            actions={<ResetButton onClick={clearAll} />}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('pdfTools.watermarkText')}>
                <Input
                  value={text}
                  maxLength={MAX_TEXT}
                  placeholder={t('pdfTools.watermarkPlaceholder')}
                  disabled={busy}
                  onChange={(e) => setText(e.target.value)}
                />
              </Field>
              <Field label={t('pdfTools.positionLabel')}>
                <Select
                  value={layout}
                  onChange={(e) => setLayout(e.target.value as WatermarkLayout)}
                  disabled={busy}
                  options={WATERMARK_LAYOUTS.map((value) => ({
                    value,
                    label: t(`pdfTools.wm_${value}` as never),
                  }))}
                />
              </Field>
              <div className="space-y-1.5">
                <Slider
                  min={5}
                  max={100}
                  value={opacity}
                  onValueChange={setOpacity}
                  label={`${t('controls.opacity')} (%)`}
                  disabled={busy}
                />
              </div>
              <Field label={`${t('controls.fontSize')} (pt)`}>
                <Input
                  type="number"
                  min={8}
                  max={240}
                  value={fontSize}
                  disabled={busy}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                />
              </Field>
              <div className="flex items-end sm:col-span-2">
                <Button
                  onClick={apply}
                  loading={busy}
                  disabled={busy || !text.trim()}
                  className="w-full sm:w-auto"
                >
                  {t('pdfTools.applyWatermark')}
                </Button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">{t('pdfTools.watermarkLatinNote')}</p>
          </ToolPanel>

          {result && (
            <ToolPanel title={t('pdfTools.watermarkReady')}>
              <div className="flex flex-wrap items-center gap-3">
                <DownloadButton blob={result} filename={`${base}-watermarked.pdf`} />
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
