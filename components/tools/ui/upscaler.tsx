'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { ControlsCard, PreviewBox, useObjectUrl } from './common';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import type { UploadError } from '@/components/tools/file-uploader';
import { ResultPanel } from '@/components/tools/result-panel';
import { Notice, PrivacyNotice, ProgressBar, ToggleGroup } from '@/components/tools/kit';
import type { ProcessResult } from '@/lib/types';
import { formatBytes } from '@/lib/utils';
import { upscaleImage, type UpscaleFormat } from '@/lib/tools/processors/upscaler';
import {
  MAX_OUTPUT_EDGE,
  MAX_OUTPUT_PIXELS,
  modelInfoFor,
  type UpscaleFactor,
  type UpscaleProgress,
} from '@/lib/ai/upscaler';

type ScaleChoice = '2' | '3' | '4';

const SCALES: ScaleChoice[] = ['2', '3', '4'];

const KNOWN_ERRORS = ['upscaler-too-large', 'image-too-large', 'decode-failed', 'encode-failed', 'no-2d-context'];

/**
 * AI image upscaler — an ESRGAN network running in TensorFlow.js on the
 * visitor's own device. Upload, inference and download all happen locally.
 */
export default function ImageUpscalerTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const [scale, setScale] = React.useState<ScaleChoice>('2');
  const [format, setFormat] = React.useState<UpscaleFormat>('same');
  const [progress, setProgress] = React.useState<UpscaleProgress | null>(null);
  const [backend, setBackend] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<ProcessResult[]>([]);
  const [error, setError] = React.useState<UploadError | null>(null);
  const [busy, setBusy] = React.useState(false);
  const cancelled = React.useRef(false);
  const preview = useObjectUrl(ctx.files[0]);

  const decoded = ctx.decoded[0];
  const factor = Number(scale) as UpscaleFactor;

  React.useEffect(
    () => () => {
      cancelled.current = true;
    },
    [],
  );

  // Refuse sizes whose upscaled bitmap would blow the in-browser canvas limits
  // — decided before the button is pressed, not mid-run.
  const fits = React.useCallback(
    (scale: number) => {
      if (!decoded) return true;
      const outW = decoded.width * scale;
      const outH = decoded.height * scale;
      return outW <= MAX_OUTPUT_EDGE && outH <= MAX_OUTPUT_EDGE && outW * outH <= MAX_OUTPUT_PIXELS;
    },
    [decoded],
  );
  const tooLarge = !fits(factor);
  /** Largest magnification this image can still be upscaled with. */
  const largestFit = SCALES.filter((value) => fits(Number(value))).pop() ?? null;

  const run = async () => {
    if (!decoded || busy) return;
    cancelled.current = false;
    setBusy(true);
    setError(null);
    setResults([]);
    setProgress({ stage: 'model', ratio: 0 });
    try {
      const result = await upscaleImage([decoded], {
        scale: factor,
        format,
        onProgress: (p) => {
          if (!cancelled.current) setProgress(p);
        },
      });
      if (!cancelled.current) {
        setResults([result]);
        setBackend(await detectBackend());
      }
    } catch (e) {
      if (!cancelled.current) {
        const err = e as Error & { params?: Record<string, string | number> };
        const key = e instanceof Error ? err.message : 'encode-failed';
        setError({ key: KNOWN_ERRORS.includes(key) ? key : 'encode-failed', params: err.params });
      }
    } finally {
      if (!cancelled.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  };

  const modelSize = formatBytes(modelInfoFor(factor).sizeBytes);
  const percent = progress ? Math.round(progress.ratio * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>

          <ToggleGroup<ScaleChoice>
            label={t('controls.upscalerScale')}
            value={scale}
            onChange={setScale}
            options={SCALES.map((value) => ({
              value,
              label: `${value}×`,
              hint: t('upscaler.scaleHint', { size: formatBytes(modelInfoFor(Number(value) as UpscaleFactor).sizeBytes) }),
            }))}
          />

          <ToggleGroup<UpscaleFormat>
            label={t('toolShell.outputFormat')}
            value={format}
            onChange={setFormat}
            options={[
              { value: 'same', label: t('controls.outputSame') },
              { value: 'png', label: 'PNG' },
              { value: 'jpg', label: 'JPG' },
              { value: 'webp', label: 'WebP' },
            ]}
          />

          {decoded && (
            <p className="rounded-lg bg-secondary/50 p-2.5 text-xs tabular-nums text-muted-foreground">
              {decoded.width} × {decoded.height} px →{' '}
              <span className="font-semibold text-foreground">
                {decoded.width * factor} × {decoded.height * factor} px
              </span>
            </p>
          )}

          <Button onClick={run} disabled={busy || tooLarge} loading={busy} className="w-full">
            {t('upscaler.run')}
          </Button>

          {busy && progress && (
            <ProgressBar
              value={percent}
              max={100}
              label={progress.stage === 'model' ? t('upscaler.loadingModel', { size: modelSize }) : t('upscaler.upscaling', { percent })}
            />
          )}

          {backend && (
            <p className="text-xs text-muted-foreground">
              {t('upscaler.backend')}: {backend === 'webgl' ? t('upscaler.backendWebgl') : t('upscaler.backendCpu')}
            </p>
          )}
        </ControlsCard>

        <div className="space-y-3">
          <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
          <Notice variant="privacy">{t('upscaler.modelNote', { size: modelSize })}</Notice>
          {tooLarge && (
            <Notice variant="warning">
              {t('upscaler.tooLarge', { edge: MAX_OUTPUT_EDGE.toLocaleString('en-US') })}{' '}
              {largestFit && t('upscaler.suggest', { scale: Number(largestFit) })}
            </Notice>
          )}
          <Notice>{t('upscaler.slowNote')}</Notice>
        </div>
      </div>

      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
      {!busy && results.length === 0 && !error && <PrivacyNotice />}
    </div>
  );
}

/** Report which TensorFlow.js backend actually ran the inference. */
async function detectBackend(): Promise<string | null> {
  try {
    const { getTf, backendName } = await import('@/lib/ai/upscaler');
    return backendName(await getTf());
  } catch {
    return null;
  }
}
