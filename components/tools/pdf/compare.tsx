'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { readBytes } from '@/lib/pdf-processing';
import { extractPdfText } from '@/lib/pdf-processing/text';
import { comparePdfTexts, type PdfCompareReport } from '@/lib/pdf-processing/search';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, useErrorText } from './shared';
import { InlineError, Notice, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

const MAX_MB = 50;
const MAX_DELTA_ROWS = 30;

/** Compare two PDFs by structure and text content — locally. */
export default function PdfCompareTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [fileA, setFileA] = React.useState<File | null>(null);
  const [fileB, setFileB] = React.useState<File | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [report, setReport] = React.useState<PdfCompareReport | null>(null);

  const clear = () => {
    setFileA(null);
    setFileB(null);
    setReport(null);
    setError(null);
  };

  const compare = async () => {
    if (!fileA || !fileB) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const bytesA = await readBytes(fileA);
      const a = await extractPdfText(bytesA, undefined, (done, total) =>
        setProgress({ done, total: total * 2 }),
      );
      const bytesB = await readBytes(fileB);
      const b = await extractPdfText(bytesB, undefined, (done, total) =>
        setProgress({ done: a.pages.length + done, total: (a.pages.length + total) }),
      );
      setReport(comparePdfTexts(fileA.name, a.pages, fileB.name, b.pages));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const infoFor = (file: File | null) =>
    file ? { name: file.name, pageCount: 0, size: file.size, encrypted: false } : null;

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!report && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('pdfTools.compareFirst')}</h3>
            {fileA && infoFor(fileA) ? (
              <PdfInfoCard info={infoFor(fileA)!} onRemove={() => setFileA(null)} />
            ) : (
              <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={(f) => setFileA(f[0] ?? null)} onError={setError} disabled={busy} />
            )}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{t('pdfTools.compareSecond')}</h3>
            {fileB && infoFor(fileB) ? (
              <PdfInfoCard info={infoFor(fileB)!} onRemove={() => setFileB(null)} />
            ) : (
              <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={(f) => setFileB(f[0] ?? null)} onError={setError} disabled={busy} />
            )}
          </div>
        </div>
      )}

      {!report && fileA && fileB && (
        <ToolPanel title={t('pdfTools.compareTitle')}>
          <div className="space-y-3">
            <Notice variant="info">{t('pdfTools.compareHint')}</Notice>
            {busy && <RenderingIndicator done={progress.done} total={progress.total} />}
            <ActionButton onClick={compare} disabled={busy} processing={busy} className="w-full sm:w-auto">
              {t('pdfTools.compareAction')}
            </ActionButton>
          </div>
        </ToolPanel>
      )}

      {report && (
        <>
          <StatGrid
            columns={4}
            items={[
              { label: t('pdfTools.compareSimilarity'), value: `${report.similarity}%`, accent: true },
              { label: t('pdfTools.comparePagesA'), value: String(report.a.pages) },
              { label: t('pdfTools.comparePagesB'), value: String(report.b.pages) },
              {
                label: t('pdfTools.compareChars'),
                value: `${report.a.chars.toLocaleString()} / ${report.b.chars.toLocaleString()}`,
              },
            ]}
          />
          <ToolPanel title={t('pdfTools.results')} actions={<ResetButton onClick={clear} />}>
            {report.identicalText ? (
              <Notice variant="privacy">{t('pdfTools.compareIdentical')}</Notice>
            ) : (
              <div className="space-y-3">
                <Notice variant="info">{t('pdfTools.compareHeuristic')}</Notice>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                        <th className="p-2 text-start font-medium">{t('pdfTools.pageLabel')}</th>
                        <th className="p-2 text-end font-medium">{t('pdfTools.compareCharsA')}</th>
                        <th className="p-2 text-end font-medium">{t('pdfTools.compareCharsB')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.pageDeltas.slice(0, MAX_DELTA_ROWS).map((d) => (
                        <tr key={d.page} className="border-b border-border/50 last:border-0">
                          <td className="p-2 tabular-nums text-muted-foreground">{d.page}</td>
                          <td className="p-2 text-end tabular-nums text-foreground">{d.aChars.toLocaleString()}</td>
                          <td className="p-2 text-end tabular-nums text-foreground">{d.bChars.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </ToolPanel>
        </>
      )}
    </div>
  );
}
