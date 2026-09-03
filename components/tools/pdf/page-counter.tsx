'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { formatBytes } from '@/lib/utils';
import { inspect, type PdfFileInfo } from '@/lib/pdf-processing';
import { PdfDropzone, useErrorText } from './shared';
import { CopyButton, InlineError, Notice, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

const MAX_FILES = 20;
const MAX_MB = 50;

export default function PdfPageCounterTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [rows, setRows] = React.useState<PdfFileInfo[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const add = async (files: File[]) => {
    if (rows.length + files.length > MAX_FILES) {
      setError(t('validation.tooManyFiles', { max: MAX_FILES }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const infos = await Promise.all(files.map((file) => inspect(file)));
      setRows((prev) => [...prev, ...infos]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const totalPages = rows.reduce((sum, r) => sum + r.pageCount, 0);
  const totalSize = rows.reduce((sum, r) => sum + r.size, 0);

  const asText = rows
    .map((r) => `${r.name}\t${r.encrypted ? '—' : r.pageCount}\t${formatBytes(r.size)}`)
    .join('\n');

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {rows.length < MAX_FILES && (
        <PdfDropzone
          multiple
          maxFiles={MAX_FILES - rows.length}
          maxFileSizeMB={MAX_MB}
          onFiles={add}
          onError={setError}
          disabled={busy}
        />
      )}

      {rows.length > 0 && (
        <>
          <StatGrid
            columns={3}
            items={[
              { label: t('pdfTools.filesCount'), value: String(rows.length) },
              { label: t('pdfTools.totalPages'), value: String(totalPages), accent: true },
              { label: t('pdfTools.totalSize'), value: formatBytes(totalSize) },
            ]}
          />

          <ToolPanel
            title={t('pdfTools.results')}
            actions={
              <>
                <CopyButton value={asText} />
                <ResetButton
                  onClick={() => {
                    setRows([]);
                    setError(null);
                  }}
                />
              </>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-start text-xs uppercase text-muted-foreground">
                    <th className="p-2 text-start font-medium">{t('pdfTools.fileName')}</th>
                    <th className="p-2 text-end font-medium">{t('pdfTools.pages')}</th>
                    <th className="p-2 text-end font-medium">{t('pdfTools.size')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={`${row.name}-${i}`} className="border-b border-border/60 last:border-0">
                      <td className="max-w-[280px] truncate p-2 text-foreground" title={row.name}>
                        {row.name}
                      </td>
                      <td className="p-2 text-end tabular-nums text-foreground">
                        {row.encrypted ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Lock className="h-3 w-3" /> {t('pdfTools.encrypted')}
                          </span>
                        ) : (
                          row.pageCount
                        )}
                      </td>
                      <td className="p-2 text-end tabular-nums text-muted-foreground">{formatBytes(row.size)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="p-2 text-foreground">{t('pdfTools.total')}</td>
                    <td className="p-2 text-end tabular-nums text-foreground">{totalPages}</td>
                    <td className="p-2 text-end tabular-nums text-foreground">{formatBytes(totalSize)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </ToolPanel>
        </>
      )}

      {!rows.length && (
        <>
          <Notice>{t('pdfTools.counterHint', { max: MAX_FILES })}</Notice>
          <PrivacyNotice />
        </>
      )}
    </div>
  );
}
