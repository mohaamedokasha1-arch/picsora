'use client';

import * as React from 'react';
import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { inspect, readBytes } from '@/lib/pdf-processing';
import { openWithPdfJs } from '@/lib/pdf-processing/render';
import { pagesToText } from '@/lib/pdf-processing/text';
import { OCR_LANGS, recognizeImage, shrinkForOcr, type OcrLang } from '@/lib/ocr/tesseract';
import { PdfDropzone, downloadZip, useErrorText } from './shared';
import {
  InlineError,
  Notice,
  PrivacyNotice,
  ProgressBar,
  ResetButton,
  StatGrid,
  ToggleGroup,
  ToolPanel,
} from '../kit';

const MAX_FILES = 3;
const MAX_MB = 50;
/** Rendering + OCR is heavy; cap pages per document to protect the tab. */
const MAX_PAGES = 30;

/** OCR for scanned PDFs: render each page locally, then recognise text. */
export default function PdfOcrTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [files, setFiles] = React.useState<File[]>([]);
  const [lang, setLang] = React.useState<OcrLang>('eng');
  const [results, setResults] = React.useState<
    { name: string; txtName: string; blob: Blob; pages: number; chars: number }[]
  >([]);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0, label: '' });
  const cancelled = React.useRef(false);

  React.useEffect(() => () => {
    cancelled.current = true;
  }, []);

  const add = async (incoming: File[]) => {
    if (files.length + incoming.length > MAX_FILES) {
      setError(t('validation.tooManyFiles', { max: MAX_FILES }));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      for (const file of incoming) await inspect(file);
      setFiles((prev) => [...prev, ...incoming]);
      setResults([]);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    cancelled.current = true;
    setFiles([]);
    setResults([]);
    setError(null);
    setProgress({ done: 0, total: 0, label: '' });
  };

  const run = async () => {
    if (!files.length || busy) return;
    cancelled.current = false;
    setBusy(true);
    setError(null);
    setResults([]);
    try {
      const out: { name: string; txtName: string; blob: Blob; pages: number; chars: number }[] = [];
      for (let fi = 0; fi < files.length; fi += 1) {
        const file = files[fi];
        const bytes = await readBytes(file);
        const doc = await openWithPdfJs(bytes);
        try {
          const total = Math.min(doc.numPages, MAX_PAGES);
          const pageTexts: string[] = [];
          for (let page = 1; page <= total; page += 1) {
            if (cancelled.current) return;
            setProgress({
              done: page,
              total,
              label: t('ocr.pageProgress', { file: file.name, done: page, total }),
            });
            const rendered = await doc.renderPage(page, 2, 'image/png');
            const shrunk = await shrinkForOcr(rendered.blob);
            const text = await recognizeImage(shrunk, lang);
            pageTexts.push(text);
            await new Promise((r) => window.setTimeout(r, 0));
          }
          const combined = pagesToText(pageTexts, file.name);
          const base = sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document');
          out.push({
            name: file.name,
            txtName: `${base}-ocr.txt`,
            blob: new Blob([combined], { type: 'text/plain;charset=utf-8' }),
            pages: total,
            chars: combined.length,
          });
          setResults([...out]);
        } finally {
          await doc.destroy().catch(() => undefined);
        }
      }
    } catch (e) {
      const key = e instanceof Error ? e.message : 'ocr-failed';
      setError(/^ocr-|^[a-zA-Z]+$/.test(key) ? tryTranslate(key) : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const tryTranslate = (key: string): string => {
    try {
      return t(`errors.${key}` as never);
    } catch {
      return errorText(new Error(key));
    }
  };

  const zipAll = async () => {
    if (!results.length) return;
    setBusy(true);
    try {
      await downloadZip(
        results.map((r) => ({ name: r.txtName, blob: r.blob })),
        'pdf-ocr.zip',
      );
    } catch {
      setError(t('errors.zipFailed'));
    } finally {
      setBusy(false);
    }
  };

  const totalPages = results.reduce((n, r) => n + r.pages, 0);

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {files.length < MAX_FILES && (
        <PdfDropzone
          multiple
          maxFiles={MAX_FILES - files.length}
          maxFileSizeMB={MAX_MB}
          onFiles={add}
          onError={setError}
          disabled={busy}
        />
      )}

      {files.length > 0 && (
        <ToolPanel
          title={t('pdfTools.filesCount', { count: files.length })}
          actions={<ResetButton onClick={reset} />}
        >
          <ul className="mb-4 space-y-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground" title={f.name}>
                  {f.name} · {formatBytes(f.size)}
                </span>
              </li>
            ))}
          </ul>
          <ToggleGroup<OcrLang>
            label={t('controls.ocrLanguage')}
            value={lang}
            onChange={setLang}
            options={OCR_LANGS.map((l) => ({ value: l.value, label: t(l.labelKey as never) }))}
          />
          <div className="mt-4">
            <Button onClick={run} disabled={busy || !files.length} loading={busy}>
              {t('ocr.start')}
            </Button>
          </div>
          {busy && (
            <div className="mt-3">
              <ProgressBar value={progress.done} max={progress.total} label={progress.label} />
            </div>
          )}
        </ToolPanel>
      )}

      {results.length > 0 && (
        <>
          <StatGrid
            columns={3}
            items={[
              { label: t('pdfTools.filesCount', { count: results.length }), value: String(results.length) },
              { label: t('pdfTools.totalPages'), value: String(totalPages), accent: true },
              { label: t('pdfTools.outputFormat'), value: '.TXT' },
            ]}
          />
          <ToolPanel
            title={t('pdfTools.results')}
            actions={
              results.length > 1 ? (
                <Button variant="outline" size="sm" onClick={zipAll} disabled={busy}>
                  {t('common.downloadAll')} (ZIP)
                </Button>
              ) : undefined
            }
          >
            <div className="space-y-3">
              {results.map((r) => (
                <div
                  key={r.txtName}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground" title={r.name}>
                      {r.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('pdfTools.pagesCount', { count: r.pages })} ·{' '}
                      {t('pdfTools.charsCount', { count: r.chars.toLocaleString() })}
                    </p>
                  </div>
                  <DownloadButton blob={r.blob} filename={r.txtName} size="sm" />
                </div>
              ))}
            </div>
          </ToolPanel>
        </>
      )}

      {!files.length && (
        <>
          <Notice>{t('pdfTools.ocrHint')}</Notice>
          <Notice variant="warning">{t('ocr.pageLimitNote', { max: MAX_PAGES })}</Notice>
          <Notice variant="privacy">{t('ocr.modelNote')}</Notice>
          <PrivacyNotice />
        </>
      )}
    </div>
  );
}
