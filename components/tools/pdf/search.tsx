'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { readBytes } from '@/lib/pdf-processing';
import { extractPdfText } from '@/lib/pdf-processing/text';
import { searchPdfText, type PdfSearchReport } from '@/lib/pdf-processing/search';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, useSinglePdf } from './shared';
import {
  CheckboxRow,
  Field,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  ToolPanel,
} from '../kit';

const MAX_MB = 50;

/** Full-text search inside a PDF with page numbers and context snippets. */
export default function PdfSearchTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [pages, setPages] = React.useState<string[] | null>(null);
  const [query, setQuery] = React.useState('');
  const [caseSensitive, setCaseSensitive] = React.useState(false);

  const clear = () => {
    reset();
    setPages(null);
    setQuery('');
  };

  const index = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const bytes = await readBytes(file);
      const { pages: texts } = await extractPdfText(bytes, undefined, (done, total) =>
        setProgress({ done, total }),
      );
      setPages(texts);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const report: PdfSearchReport | null = React.useMemo(() => {
    if (!pages || !query.trim()) return null;
    return searchPdfText(pages, query, caseSensitive);
  }, [pages, query, caseSensitive]);

  const highlight = (context: string, q: string) => {
    const needle = caseSensitive ? q.trim() : q.trim().toLowerCase();
    if (!needle) return context;
    const hay = caseSensitive ? context : context.toLowerCase();
    const at = hay.indexOf(needle);
    if (at < 0) return context;
    return (
      <>
        {context.slice(0, at)}
        <mark className="rounded bg-primary/20 px-0.5 font-medium text-foreground">
          {context.slice(at, at + q.trim().length)}
        </mark>
        {context.slice(at + q.trim().length)}
      </>
    );
  };

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!file && <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} disabled={busy} />}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clear} />
          {pages === null ? (
            <ToolPanel title={t('pdfTools.pdfSearchTitle')}>
              <div className="space-y-3">
                <Notice variant="info">{t('pdfTools.toTextHint')}</Notice>
                {busy && <RenderingIndicator done={progress.done} total={progress.total} />}
                <ActionButton onClick={index} disabled={busy} processing={busy} className="w-full sm:w-auto">
                  {t('pdfTools.pdfSearchIndex')}
                </ActionButton>
              </div>
            </ToolPanel>
          ) : (
            <>
              <ToolPanel title={t('pdfTools.pdfSearchTitle')} actions={<ResetButton onClick={clear} />}>
                <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                  <Field label={t('pdfTools.pdfSearchQuery')}>
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={t('pdfTools.pdfSearchPh')}
                      maxLength={200}
                    />
                  </Field>
                  <CheckboxRow
                    checked={caseSensitive}
                    onChange={setCaseSensitive}
                    label={t('pdfTools.pdfSearchCase')}
                  />
                </div>
              </ToolPanel>

              {report && (
                <>
                  <StatGrid
                    columns={3}
                    items={[
                      { label: t('pdfTools.pdfSearchMatches'), value: String(report.total), accent: true },
                      { label: t('pdfTools.pdfSearchPages'), value: String(report.perPage.length) },
                      { label: t('pdfTools.pages'), value: String(pages.length) },
                    ]}
                  />
                  <ToolPanel title={t('pdfTools.results')}>
                    {report.matches.length === 0 ? (
                      <Notice variant="info">{t('pdfTools.pdfSearchNone')}</Notice>
                    ) : (
                      <ul className="divide-y divide-border">
                        {report.matches.map((m, i) => (
                          <li key={i} className="flex gap-3 py-2.5 text-sm">
                            <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                              {t('pdfTools.pageLabel')} {m.page}
                            </span>
                            <span className="min-w-0 break-words leading-relaxed text-muted-foreground">
                              {highlight(m.context, report.query)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </ToolPanel>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
