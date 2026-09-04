'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { ControlsCard, useObjectUrl, PreviewBox } from './common';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import {
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ProgressBar,
  ResetButton,
  TextDownloadButton,
  ToggleGroup,
  ToolPanel,
} from '@/components/tools/kit';
import { OCR_LANGS, recognizeImage, shrinkForOcr, type OcrLang } from '@/lib/ocr/tesseract';
import { heicToImageFile, isHeicFile } from '@/lib/image/heic';
import { sanitizeFilename } from '@/lib/utils';
import { nameOf } from '@/lib/image/process';

/** Extract text from photos and screenshots — locally with Tesseract.js. */
export default function ImageOcrTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const [lang, setLang] = React.useState<OcrLang>('eng');
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0, ratio: 0 });
  const [texts, setTexts] = React.useState<{ name: string; text: string }[]>([]);
  const [error, setError] = React.useState<{ key: string } | null>(null);
  const cancelled = React.useRef(false);
  const preview = useObjectUrl(ctx.files[0]);

  React.useEffect(() => () => {
    cancelled.current = true;
  }, []);

  const extract = async () => {
    if (!ctx.files.length || busy) return;
    cancelled.current = false;
    setBusy(true);
    setError(null);
    setTexts([]);
    const out: { name: string; text: string }[] = [];
    try {
      const total = ctx.files.length;
      for (let i = 0; i < total; i += 1) {
        if (cancelled.current) break;
        const file = ctx.files[i];
        setProgress({ done: i, total, ratio: 0 });
        // Tesseract cannot read HEIC — convert locally first.
        const readable = isHeicFile(file) ? await heicToImageFile(file, 'jpg') : file;
        const shrunk = await shrinkForOcr(readable);
        const text = await recognizeImage(shrunk, lang, (ratio) =>
          setProgress({ done: i, total, ratio }),
        );
        out.push({ name: file.name, text });
        setTexts([...out]);
        setProgress({ done: i + 1, total, ratio: 1 });
        await new Promise((r) => window.setTimeout(r, 0));
      }
    } catch (e) {
      const key = e instanceof Error ? e.message : 'ocr-failed';
      setError({ key });
    } finally {
      setBusy(false);
    }
  };

  const combined = texts.map((r) => `----- ${r.name} -----\n${r.text || `(${t('ocr.noText')})`}`).join('\n\n');

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <ToggleGroup<OcrLang>
            label={t('controls.ocrLanguage')}
            value={lang}
            onChange={setLang}
            options={OCR_LANGS.map((l) => ({ value: l.value, label: t(l.labelKey as never) }))}
          />
          <Button onClick={extract} disabled={busy} loading={busy} className="w-full">
            {t('ocr.start')}
          </Button>
          {busy && (
            <ProgressBar
              value={progress.done + progress.ratio}
              max={progress.total}
              label={t('ocr.extracting', { done: progress.done + 1, total: progress.total })}
            />
          )}
        </ControlsCard>

        <div className="space-y-3">
          <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
          <Notice variant="privacy">{t('ocr.modelNote')}</Notice>
        </div>
      </div>

      {busy && texts.length === 0 && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}

      {texts.length > 0 && (
        <ToolPanel
          title={t('ocr.resultTitle')}
          actions={
            <>
              <CopyButton value={combined} />
              <TextDownloadButton
                value={combined}
                filename={`${sanitizeFilename(nameOf(ctx.files[0]))}-ocr.txt`}
              />
              <ResetButton
                onClick={() => {
                  setTexts([]);
                  setError(null);
                }}
              />
            </>
          }
        >
          {texts.map((r) => (
            <div key={r.name} className="mb-4 last:mb-0">
              <p className="mb-1 text-xs font-medium text-muted-foreground">{r.name}</p>
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg border border-input bg-background p-3 font-mono text-[13px] leading-relaxed text-foreground">
                {r.text || <span className="text-muted-foreground">{t('ocr.noText')}</span>}
              </pre>
            </div>
          ))}
        </ToolPanel>
      )}

      {!busy && texts.length === 0 && !error && <InlineError message={null} />}
      <PrivacyNotice />
    </div>
  );
}
