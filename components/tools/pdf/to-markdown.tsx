'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { sanitizeFilename } from '@/lib/utils';
import { readBytes } from '@/lib/pdf-processing';
import { extractPdfText } from '@/lib/pdf-processing/text';
import { pagesToMarkdown } from '@/lib/pdf-processing/export';
import { PdfDropzone, PdfInfoCard, RenderingIndicator, useSinglePdf } from './shared';
import {
  CodeArea,
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  ToolPanel,
} from '../kit';

const MAX_MB = 50;

/** Convert a PDF's text layer into a clean Markdown document. */
export default function PdfToMarkdownTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [markdown, setMarkdown] = React.useState<string | null>(null);
  const [pages, setPages] = React.useState(0);

  const clear = () => {
    reset();
    setMarkdown(null);
    setPages(0);
  };

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setMarkdown(null);
    try {
      const bytes = await readBytes(file);
      const { pages: texts } = await extractPdfText(bytes, undefined, (done, total) =>
        setProgress({ done, total }),
      );
      setPages(texts.length);
      setMarkdown(pagesToMarkdown(texts, file.name));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const blob = React.useMemo(
    () => (markdown !== null ? new Blob([markdown], { type: 'text/markdown;charset=utf-8' }) : null),
    [markdown],
  );

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      {!file && <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} disabled={busy} />}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clear} />
          {markdown === null ? (
            <ToolPanel title={t('pdfTools.toMdTitle')}>
              <div className="space-y-3">
                <Notice variant="info">{t('pdfTools.toTextHint')}</Notice>
                {busy && <RenderingIndicator done={progress.done} total={progress.total} />}
                <ActionButton onClick={convert} disabled={busy} processing={busy} className="w-full sm:w-auto">
                  {t('pdfTools.toMdAction')}
                </ActionButton>
              </div>
            </ToolPanel>
          ) : (
            <ToolPanel
              title={t('pdfTools.results')}
              actions={
                <>
                  <CopyButton value={markdown} />
                  <ResetButton onClick={clear} />
                </>
              }
            >
              <p className="mb-3 text-sm text-muted-foreground">
                {t('pdfTools.pagesCount', { count: pages })}
              </p>
              <CodeArea value={markdown} readOnly ariaLabel={t('pdfTools.results')} minHeight={320} />
              {blob && (
                <div className="mt-3">
                  <DownloadButton
                    blob={blob}
                    filename={sanitizeFilename(`${file.name.replace(/\.pdf$/i, '')}.md`)}
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
