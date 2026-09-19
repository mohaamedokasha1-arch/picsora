'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox, Field } from './common';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';

import { ActionButton } from '@/components/ui/action-button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { Notice, ToggleGroup } from '@/components/tools/kit';
import { upscaleImage } from '@/lib/tools/processors/upscale';
import type { ImageFormat } from '@/lib/types';

/** Enlarge an image 2×/4× with high-quality stepped resampling. */
export default function UpscaleTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [scale, setScale] = React.useState<'2' | '4'>('2');
  const [format, setFormat] = React.useState<ImageFormat>('png');
  const [quality, setQuality] = React.useState(92);
  const [background, setBackground] = React.useState('#ffffff');
  const preview = useObjectUrl(ctx.files[0]);

  const originalSize = ctx.files.reduce((sum, f) => sum + f.size, 0);
  const isLossy = format === 'jpg' || format === 'jpeg' || format === 'webp';

  const process = () => {
    run(() =>
      upscaleImage(ctx.decoded, {
        scale: scale === '4' ? 4 : 2,
        format,
        quality,
        background,
      }),
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <ToggleGroup<'2' | '4'>
            label={t('upscale.scale')}
            value={scale}
            onChange={setScale}
            options={[
              { value: '2', label: '2×' },
              { value: '4', label: '4×' },
            ]}
          />
          {decoded && (
            <p className="text-xs text-muted-foreground">
              {t('upscale.outputDims', {
                w: decoded.width * Number(scale),
                h: decoded.height * Number(scale),
              })}
            </p>
          )}
          <Field label={t('toolShell.outputFormat')}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as ImageFormat)}
              disabled={processing}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
                { value: 'webp', label: 'WebP' },
              ]}
            />
          </Field>
          {isLossy && (
            <Slider
              label={t('controls.quality')}
              min={1}
              max={100}
              value={quality}
              onValueChange={setQuality}
              valueSuffix="%"
              disabled={processing}
            />
          )}
          {format === 'jpg' && (
            <Field label={t('controls.background')}>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  disabled={processing}
                  aria-label={t('controls.background')}
                  className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
                />
                <Input
                  value={background}
                  onChange={(e) => setBackground(e.target.value)}
                  disabled={processing}
                  className="flex-1"
                  aria-label={t('controls.background')}
                />
              </div>
            </Field>
          )}
          <Notice variant="info">{t('upscale.honestNote')}</Notice>
          <ActionButton onClick={process} disabled={processing} processing={processing} success={results.length > 0 && !processing && !error} className="w-full">
            {t('upscale.enlarge', { scale })}
          </ActionButton>
        </ControlsCard>

        <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={originalSize} onReset={ctx.reset} />
    </div>
  );
}
