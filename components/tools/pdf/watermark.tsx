'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Stamp, Download, Loader2, FileCheck } from 'lucide-react';
import type { ToolDef } from '@/lib/tools/registry';
import { PdfDropzone, useErrorText, PdfInfoCard } from './shared';
import { watermarkPdf, type PdfFileInfo, inspect, type WatermarkOptions } from '@/lib/pdf-processing';
import { ToolPanel, PrivacyNotice, ProgressBar, ControlsCard, Field } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { triggerDownload } from '@/lib/image/format';
import { formatBytes } from '@/lib/utils';

export default function PdfWatermark({ tool }: { tool: ToolDef }) {
  const t = useTranslations();
  const formatError = useErrorText();

  const [file, setFile] = React.useState<File | null>(null);
  const [info, setInfo] = React.useState<PdfFileInfo | null>(null);
  const [text, setText] = React.useState('CONFIDENTIAL');
  const [position, setPosition] = React.useState<'diagonal' | 'center' | 'top' | 'bottom'>('diagonal');
  const [opacity, setOpacity] = React.useState<number>(30); // 0..100
  const [fontSize, setFontSize] = React.useState<number>(48);
  const [colorHex, setColorHex] = React.useState('#e11d48');

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

  const applyWatermark = async () => {
    if (!file) return;
    if (!text.trim()) {
      setError('Please enter watermark text');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const blob = await watermarkPdf(
        file,
        {
          text: text.trim(),
          position,
          opacity: opacity / 100,
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
    triggerDownload(resultBlob, `${file.name.replace(/\.pdf$/i, '')}-watermarked.pdf`);
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
              <div className="sm:col-span-2">
                <Field label="Watermark Text" hint="Text to stamp on all PDF pages">
                  <Input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="CONFIDENTIAL, DRAFT, COPY..."
                    className="font-medium"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {['CONFIDENTIAL', 'DRAFT', 'COPY', 'ORIGINAL', 'SAMPLE', 'TOP SECRET'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setText(preset)}
                        className="rounded-md border border-border bg-secondary/40 px-2 py-1 text-xs text-foreground hover:bg-accent"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="Position">
                <Select
                  value={position}
                  onChange={(e) => setPosition(e.target.value as 'diagonal' | 'center' | 'top' | 'bottom')}
                >
                  <option value="diagonal">Diagonal (45° Center)</option>
                  <option value="center">Horizontal Center</option>
                  <option value="top">Header (Top)</option>
                  <option value="bottom">Footer (Bottom)</option>
                </Select>
              </Field>

              <Field label="Opacity">
                <div className="pt-2">
                  <Slider
                    label="Opacity"
                    min={5}
                    max={100}
                    step={5}
                    valueSuffix="%"
                    value={opacity}
                    onValueChange={setOpacity}
                  />
                </div>
              </Field>

              <Field label="Font Size">
                <div className="pt-2">
                  <Slider
                    label="Font Size"
                    min={14}
                    max={120}
                    step={2}
                    valueSuffix=" pt"
                    value={fontSize}
                    onValueChange={setFontSize}
                  />
                </div>
              </Field>

              <Field label="Watermark Color">
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
              <span className="text-xs text-muted-foreground">{info.pageCount} pages will be watermarked</span>
              <Button onClick={applyWatermark} disabled={loading || !text.trim()} size="lg">
                {loading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    Adding Watermark...
                  </>
                ) : (
                  <>
                    <Stamp className="me-2 h-4 w-4" />
                    Apply Watermark to PDF
                  </>
                )}
              </Button>
            </div>
          </ControlsCard>

          {loading && progress && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  Stamping page {progress.done} of {progress.total}...
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
                    <p className="font-semibold text-foreground">Watermark Applied Successfully!</p>
                    <p className="text-xs text-muted-foreground">{formatBytes(resultBlob.size)}</p>
                  </div>
                </div>
                <Button onClick={download} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Download className="me-2 h-4 w-4" />
                  Download Watermarked PDF
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
