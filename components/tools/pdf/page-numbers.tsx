'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Hash, Download, Loader2, FileCheck } from 'lucide-react';
import type { ToolDef } from '@/lib/tools/registry';
import { PdfDropzone, useErrorText, PdfInfoCard } from './shared';
import { addPageNumbersToPdf, type PdfFileInfo, inspect, type PageNumberOptions } from '@/lib/pdf-processing';
import { ToolPanel, PrivacyNotice, ProgressBar, ControlsCard, Field } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { triggerDownload } from '@/lib/image/format';
import { formatBytes } from '@/lib/utils';

export default function PdfPageNumbers({ tool }: { tool: ToolDef }) {
  const t = useTranslations();
  const formatError = useErrorText();

  const [file, setFile] = React.useState<File | null>(null);
  const [info, setInfo] = React.useState<PdfFileInfo | null>(null);
  const [format, setFormat] = React.useState<'page-of-total' | 'page-only' | 'page-prefix'>('page-of-total');
  const [position, setPosition] = React.useState<'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'>('bottom-center');
  const [startNumber, setStartNumber] = React.useState<number>(1);
  const [fontSize, setFontSize] = React.useState<number>(10);
  const [colorHex, setColorHex] = React.useState('#444444');

  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    setFile(f);
    setError(null);
    setResultBlob(null);
    try {
      const probe = await inspect(f);
      setInfo(probe);
    } catch (err) {
      setError(formatError(err));
    }
  };

  const applyNumbers = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const blob = await addPageNumbersToPdf(
        file,
        {
          format,
          position,
          startNumber,
          fontSize,
          colorHex,
        },
        (done, total) => {
          setProgress({ done, total });
        },
      );
      setResultBlob(blob);
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
    setResultBlob(null);
    setError(null);
    setProgress(null);
  };

  const download = () => {
    if (!resultBlob || !file) return;
    triggerDownload(resultBlob, `${file.name.replace(/\.pdf$/i, '')}-numbered.pdf`);
  };

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
        <div className="space-y-6">
          <PdfInfoCard info={info} onRemove={reset} />

          <ControlsCard>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Numbering Format">
                <Select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as 'page-of-total' | 'page-only' | 'page-prefix')}
                >
                  <option value="page-of-total">Page 1 of {info.pageCount} (Recommended)</option>
                  <option value="page-prefix">Page 1</option>
                  <option value="page-only">1 (Number only)</option>
                </Select>
              </Field>

              <Field label="Position">
                <Select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as typeof position)}
                >
                  <option value="bottom-center">Bottom Center (Standard)</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="bottom-left">Bottom Left</option>
                  <option value="top-center">Top Center</option>
                  <option value="top-right">Top Right</option>
                  <option value="top-left">Top Left</option>
                </Select>
              </Field>

              <Field label="Start Number">
                <Input
                  type="number"
                  min={1}
                  value={startNumber}
                  onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>

              <Field label="Font Size">
                <div className="pt-2">
                  <Slider
                    label="Font Size"
                    min={8}
                    max={24}
                    step={1}
                    valueSuffix=" pt"
                    value={fontSize}
                    onValueChange={setFontSize}
                  />
                </div>
              </Field>

              <Field label="Text Color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </Field>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">{info.pageCount} pages will be numbered</span>
              <Button onClick={applyNumbers} disabled={loading} size="lg">
                {loading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    Numbering Pages...
                  </>
                ) : (
                  <>
                    <Hash className="me-2 h-4 w-4" />
                    Add Page Numbers to PDF
                  </>
                )}
              </Button>
            </div>
          </ControlsCard>

          {loading && progress && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  Numbering page {progress.done} of {progress.total}...
                </span>
                <span className="font-semibold text-primary">
                  {Math.round((progress.done / progress.total) * 100)}%
                </span>
              </div>
              <ProgressBar value={progress.done} max={progress.total} />
            </div>
          )}

          {resultBlob && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <FileCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-foreground">Page Numbers Added Successfully!</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(resultBlob.size)}</p>
                  </div>
                </div>
                <Button onClick={download} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Download className="me-2 h-4 w-4" />
                  Download Numbered PDF
                </Button>
              </div>
            </div>
          )}

          <PrivacyNotice />
        </div>
      )}
    </div>
  );
}
