'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { sanitizeFilename } from '@/lib/utils';
import { readBytes } from '@/lib/pdf-processing';
import { extractPdfText } from '@/lib/pdf-processing/text';
import { pagesToHtml } from '@/lib/pdf-processing/export';
import { assertMeaningfulExtractableText, assertValidOutput } from '@/lib/output-validation';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, useSinglePdf } from './shared';
import {
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  ToggleGroup,
  ToolPanel,
} from '../kit';

const MAX_MB = 50;

/** Convert a PDF's text layer into a standalone styled HTML page. */
export default function PdfToHtmlTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [html, setHtml] = React.useState<string | null>(null);
  const [view, setView] = React.useState<'preview' | 'code'>('preview');

  const clear = () => {
    reset();
    setHtml(null);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setHtml(null);
    try {
      const bytes = await readBytes(file);
      const { pages, totalChars } = await extractPdfText(bytes, undefined, (done, total) =>
        setProgress({ done, total }),
      );
      assertMeaningfulExtractableText(pages);
      const output = pagesToHtml(pages, file.name);
      await assertValidOutput(new Blob([output], { type: 'text/html;charset=utf-8' }), { format: 'html', minTextLength: Math.max(1, totalChars) });
      setHtml(output);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const blob = React.useMemo(
    () => (html !== null ? new Blob([html], { type: 'text/html;charset=utf-8' }) : null),
    [html],
  );

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!file && <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} disabled={busy} />}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clear} />
          {html === null ? (
            <ToolPanel title={t('pdfTools.toHtmlTitle')}>
              <div className="space-y-3">
                <Notice variant="info">{t('pdfTools.toTextHint')}</Notice>
                {busy && <RenderingIndicator done={progress.done} total={progress.total} />}
                <ActionButton onClick={convert} disabled={busy} processing={busy} className="w-full sm:w-auto">
                  {t('pdfTools.toHtmlAction')}
                </ActionButton>
              </div>
            </ToolPanel>
          ) : (
            <ToolPanel
              title={t('pdfTools.results')}
              actions={
                <>
                  <CopyButton value={html} />
                  <ResetButton onClick={clear} />
                </>
              }
            >
              <ToggleGroup<'preview' | 'code'>
                label={t('pdfTools.previewLabel')}
                value={view}
                onChange={setView}
                options={[
                  { value: 'preview', label: t('pdfTools.toHtmlPreview') },
                  { value: 'code', label: t('pdfTools.toHtmlCode') },
                ]}
              />
              {view === 'preview' ? (
                <iframe
                  title={t('pdfTools.toHtmlPreview')}
                  sandbox=""
                  srcDoc={html}
                  className="mt-3 h-[420px] w-full rounded-lg border border-border bg-white"
                />
              ) : (
                <textarea
                  dir="ltr"
                  aria-label={t('pdfTools.toHtmlCode')}
                  readOnly
                  value={html}
                  spellCheck={false}
                  className="mt-3 h-[320px] w-full resize-y rounded-lg border border-input bg-background p-3 font-mono text-[13px] leading-relaxed text-foreground"
                />
              )}
              {blob && (
                <div className="mt-3">
                  <DownloadButton
                    blob={blob}
                    filename={sanitizeFilename(`${file.name.replace(/\.pdf$/i, '')}.html`)}
                  />
                </div>
              )}
            </ToolPanel>
          )}
        </>
      )}
    </div>
  );
}
