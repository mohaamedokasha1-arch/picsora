'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ScanText, Download, Copy, Check, Loader2, Sparkles, Languages } from 'lucide-react';
import { FileUploader, type UploadError } from '@/components/tools/file-uploader';
import { ErrorDisplay } from '@/components/tools/error-display';
import { defaultRuleFor } from '@/lib/validation';
import { ToolPanel, CopyButton, TextDownloadButton, PrivacyNotice, TextArea, ProgressBar } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function OcrImageToText() {
  const t = useTranslations();
  const [file, setFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [language, setLanguage] = React.useState<string>('eng');
  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState<{ status: string; progress: number } | null>(null);
  const [error, setError] = React.useState<UploadError | null>(null);
  const [extractedText, setExtractedText] = React.useState<string>('');
  const [confidence, setConfidence] = React.useState<number | null>(null);

  const rule = React.useMemo(() => defaultRuleFor(['jpg', 'jpeg', 'png', 'webp', 'bmp', 'heic', 'heif', 'tiff', 'tif'], 1, 50), []);

  const handleFiles = (files: File[]) => {
    if (!files.length) return;
    const selected = files[0];
    setFile(selected);
    setError(null);
    setExtractedText('');
    setConfidence(null);
    setPreviewUrl(URL.createObjectURL(selected));
  };

  const runOcr = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setExtractedText('');
    setConfidence(null);
    setProgress({ status: 'Initializing OCR Engine...', progress: 10 });

    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(language, 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress({
              status: `Recognizing text (${Math.round(m.progress * 100)}%)...`,
              progress: Math.round(m.progress * 100),
            });
          } else if (m.status) {
            setProgress({
              status: m.status,
              progress: Math.round((m.progress || 0) * 100),
            });
          }
        },
      });

      const ret = await worker.recognize(file);
      setExtractedText(ret.data.text.trim());
      setConfidence(Math.round(ret.data.confidence));
      await worker.terminate();
    } catch (err) {
      console.error('OCR error:', err);
      setError({ key: 'ocr-failed' });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setExtractedText('');
    setConfidence(null);
    setError(null);
    setProgress(null);
  };

  return (
    <div className="space-y-6">
      {error && <ErrorDisplay error={error} onRetry={reset} />}

      {!file && (
        <FileUploader
          rule={rule}
          files={file ? [file] : []}
          onFilesChange={handleFiles}
          onError={setError}
          disabled={loading}
        />
      )}

      {file && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ScanText className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{file.type || 'image'} · Language: {language.toUpperCase()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Languages className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={loading}
                  className="h-9 text-xs"
                >
                  <option value="eng">English</option>
                  <option value="ara">Arabic (العربية)</option>
                  <option value="fra">French (Français)</option>
                  <option value="spa">Spanish (Español)</option>
                  <option value="deu">German (Deutsch)</option>
                  <option value="ita">Italian (Italiano)</option>
                  <option value="por">Portuguese (Português)</option>
                </Select>
              </div>

              <Button onClick={runOcr} disabled={loading} size="default">
                {loading ? (
                  <>
                    <Loader2 className="me-2 h-4 w-4 animate-spin" />
                    Recognizing...
                  </>
                ) : (
                  <>
                    <ScanText className="me-2 h-4 w-4" />
                    Extract Text
                  </>
                )}
              </Button>

              <Button type="button" variant="ghost" size="sm" onClick={reset} disabled={loading}>
                {t('common.uploadDifferent')}
              </Button>
            </div>
          </div>

          {loading && progress && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">{progress.status}</span>
                <span className="font-semibold text-primary">{progress.progress}%</span>
              </div>
              <ProgressBar value={progress.progress} max={100} />
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-12">
            {/* Image Preview */}
            <div className="md:col-span-5">
              <ToolPanel title={t('controls.preview') || 'Uploaded Image'}>
                <div className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-secondary/30">
                  {previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>
              </ToolPanel>
            </div>

            {/* Extracted Text */}
            <div className="md:col-span-7">
              <ToolPanel
                title="Extracted Text"
                actions={
                  extractedText ? (
                    <div className="flex items-center gap-2">
                      {confidence !== null && (
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          {confidence}% Accuracy
                        </span>
                      )}
                      <CopyButton value={extractedText} label={t('common.copy')} />
                      <TextDownloadButton
                        value={extractedText}
                        filename={`${file.name.replace(/\.[^/.]+$/, '')}-extracted.txt`}
                        label={t('common.download')}
                      />
                    </div>
                  ) : undefined
                }
              >
                {extractedText ? (
                  <TextArea
                    value={extractedText}
                    onChange={(e) => setExtractedText(e.target.value)}
                    className="h-80 text-sm leading-relaxed"
                  />
                ) : (
                  <div className="flex h-80 flex-col items-center justify-center rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground">
                    <ScanText className="h-10 w-10 stroke-[1.5]" />
                    <p className="mt-2 text-sm font-medium text-foreground">Click &quot;Extract Text&quot; above to run OCR</p>
                    <p className="mt-1 text-xs text-muted-foreground">OCR runs 100% locally inside your browser using WebAssembly</p>
                  </div>
                )}
              </ToolPanel>
            </div>
          </div>

          <PrivacyNotice text="All OCR optical text recognition is computed locally in your browser. Images are never uploaded." />
        </div>
      )}
    </div>
  );
}
