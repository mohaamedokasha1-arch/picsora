'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, Field } from './common';
import { EffectPreview } from './effect-preview';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { ToggleGroup } from '@/components/tools/kit';
import { applyColorFilter, sharpenImage, FILTER_PRESETS, type FilterPreset } from '@/lib/image/effects';
import { applyFilterEffect } from '@/lib/tools/processors/effects';
import type { ImageFormat } from '@/lib/types';

const PRESET_LABEL: Record<FilterPreset, string> = {
  grayscale: 'controls.filterGrayscale',
  sepia: 'controls.filterSepia',
  invert: 'controls.filterInvert',
  sharpen: 'controls.filterSharpen',
};

export default function ImageFiltersTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [preset, setPreset] = React.useState<FilterPreset>('grayscale');
  const [strength, setStrength] = React.useState(100);
  const [format, setFormat] = React.useState<ImageFormat>(decoded.format);

  const effect = (data: Uint8ClampedArray, width: number, height: number) => {
    if (preset === 'sharpen') {
      sharpenImage(data, width, height, strength);
      return;
    }
    applyColorFilter(data, preset, strength);
  };

  const process = () => run(() => applyFilterEffect(ctx.decoded, { preset, strength, format }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <ToggleGroup
            value={preset}
            onChange={(value) => setPreset(value)}
            label={t('controls.filter')}
            options={FILTER_PRESETS.map((value) => ({ value, label: t(PRESET_LABEL[value] as never) }))}
          />
          <Slider
            min={5}
            max={100}
            value={strength}
            onValueChange={setStrength}
            label={preset === 'sharpen' ? t('controls.sharpenAmount') : t('controls.filterStrength')}
            valueSuffix="%"
            disabled={processing}
          />
          <Field label={t('toolShell.outputFormat')}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as ImageFormat)}
              disabled={processing}
              options={[
                { value: 'jpg', label: 'JPG' },
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WebP' },
              ]}
            />
          </Field>
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.applyFilter')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('controls.livePreviewNote')}</p>
        </ControlsCard>

        <EffectPreview decoded={decoded} effect={effect} deps={[preset, strength]} alt={ctx.files[0]?.name} />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
