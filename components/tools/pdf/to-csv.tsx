'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { sanitizeFilename } from '@/lib/utils';
import { readBytes } from '@/lib/pdf-processing';
import { extractPdfText } from '@/lib/pdf-processing/text';
import { pagesToCsv } from '@/lib/pdf-processing/export';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, useSinglePdf } from './shared';
import {
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  ToolPanel,
} from '../kit';

const MAX_MB = 50;
const PREVIEW_ROWS = 12;

/** Convert a PDF's text layer into a spreadsheet-ready CSV (page, line, text). */
export default function PdfToCsvTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [csv, setCsv] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState(0);

  const clear = () => {
    reset();
    setCsv(null);
    setRows(0);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setCsv(null);
    try {
      const bytes = await readBytes(file);
      const { pages } = await extractPdfText(bytes, undefined, (done, total) =>
        setProgress({ done, total }),
      );
      const out = pagesToCsv(pages);
      setCsv(out);
      setRows(out.split('\r\n').filter(Boolean).length - 1);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const blob = React.useMemo(
    () => (csv !== null ? new Blob([csv], { type: 'text/csv;charset=utf-8' }) : null),
    [csv],
  );

  const preview = React.useMemo(() => {
    if (!csv) return [];
    return csv
      .split('\r\n')
      .filter(Boolean)
      .slice(1, PREVIEW_ROWS + 1)
      .map((line) => {
        // Minimal display parse: page,line,"text…" — the file itself is exact.
        const m = line.match(/^(\d+),(\d+),(.*)$/);
        if (!m) return null;
        let text = m[3];
        if (text.startsWith('"') && text.endsWith('"')) {
          text = text.slice(1, -1).replace(/""/g, '"');
        }
        return { page: m[1], line: m[2], text };
      })
      .filter((r): r is { page: string; line: string; text: string } => r !== null);
  }, [csv]);

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!file && <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} disabled={busy} />}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clear} />
          {csv === null ? (
            <ToolPanel title={t('pdfTools.toCsvTitle')}>
              <div className="space-y-3">
                <Notice variant="info">{t('pdfTools.toTextHint')}</Notice>
                {busy && <RenderingIndicator done={progress.done} total={progress.total} />}
                <ActionButton onClick={convert} disabled={busy} processing={busy} className="w-full sm:w-auto">
                  {t('pdfTools.toCsvAction')}
                </ActionButton>
              </div>
            </ToolPanel>
          ) : (
            <>
              <StatGrid
                columns={3}
                items={[
                  { label: t('pdfTools.pages'), value: String(info.pageCount) },
                  { label: t('pdfTools.toCsvRows'), value: String(rows), accent: true },
                  { label: t('pdfTools.size'), value: blob ? `${(blob.size / 1024).toFixed(1)} KB` : '—' },
                ]}
              />
              <ToolPanel
                title={t('pdfTools.results')}
                actions={
                  <>
                    <CopyButton value={csv} />
                    <ResetButton onClick={clear} />
                  </>
                }
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                        <th className="p-2 text-start font-medium">{t('pdfTools.pageLabel')}</th>
                        <th className="p-2 text-start font-medium">#</th>
                        <th className="p-2 text-start font-medium">{t('pdfTools.toCsvTextCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((r, i) => (
                        <tr key={i} className="border-b border-border/50 last:border-0">
                          <td className="p-2 tabular-nums text-muted-foreground">{r.page}</td>
                          <td className="p-2 tabular-nums text-muted-foreground">{r.line}</td>
                          <td className="max-w-md truncate p-2 text-foreground" title={r.text}>
                            {r.text}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rows > PREVIEW_ROWS && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('pdfTools.toCsvMore', { count: rows - PREVIEW_ROWS })}
                  </p>
                )}
                {blob && (
                  <div className="mt-3">
                    <DownloadButton
                      blob={blob}
                      filename={sanitizeFilename(`${file.name.replace(/\.pdf$/i, '')}.csv`)}
                    />
                  </div>
                )}
              </ToolPanel>
            </>
          )}
        </>
      )}
    </div>
  );
}
