'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, Loader2, Download, Copy, Check } from 'lucide-react';
import type { ToolDef } from '@/lib/tools/registry';
import { PdfDropzone, useErrorText, PdfInfoCard } from './shared';
import { extractTextFromPdf, type PdfFileInfo, inspect } from '@/lib/pdf-processing';
import { ToolPanel, CopyButton, TextDownloadButton, PrivacyNotice, TextArea, ProgressBar } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';

export default function PdfToText({ tool }: { tool: ToolDef }) {
  const t = useTranslations();
  const formatError = useErrorText();

  const [file, setFile] = React.useState<File | null>(null);
  const [info, setInfo] = React.useState<PdfFileInfo | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [extractedText, setExtractedText] = React.useState<string>('');

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setExtractedText('');
    setLoading(true);
    try {
      const probe = await inspect(f);
      setInfo(probe);

      const text = await extractTextFromPdf(f, (done, total) => {
        setProgress({ done, total });
      });
      setExtractedText(text);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const reset = () => {
    setFile(null);
    setInfo(null);
    setExtractedText('');
    setError(null);
    setProgress(null);
  };

  const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;
  const charCount = extractedText.length;

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!file && (
        <PdfDropzone
          maxFileSizeMB={tool.maxFileSizeMB}
          onFiles={onFiles}
          onError={setError}
          disabled={loading}
        />
      )}

      {file && info && (
        <div className="space-y-4">
          <PdfInfoCard info={info} onRemove={reset} />

          {loading && progress && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  Extracting text from page {progress.done} of {progress.total}...
                </span>
                <span className="font-semibold text-primary">
                  {Math.round((progress.done / progress.total) * 100)}%
                </span>
              </div>
              <ProgressBar value={progress.done} max={progress.total} />
            </div>
          )}

          {extractedText && (
            <ToolPanel
              title={`Extracted Text (${wordCount.toLocaleString()} words · ${charCount.toLocaleString()} characters)`}
              actions={
                <div className="flex items-center gap-2">
                  <CopyButton value={extractedText} label={t('common.copy')} />
                  <TextDownloadButton
                    value={extractedText}
                    filename={`${file.name.replace(/\.pdf$/i, '')}-text.txt`}
                    label={t('common.download')}
                  />
                </div>
              }
            >
              <TextArea
                value={extractedText}
                readOnly
                className="h-96 font-mono text-xs leading-relaxed"
              />
            </ToolPanel>
          )}

          <PrivacyNotice />
        </div>
      )}
    </div>
  );
}
