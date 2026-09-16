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
import { ActionButton } from '@/components/ui/action-button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { applyBrightnessContrast } from '@/lib/image/effects';
import { adjustImage } from '@/lib/tools/processors/effects';
import type { ImageFormat } from '@/lib/types';

export default function BrightnessContrastTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [brightness, setBrightness] = React.useState(0);
  const [contrast, setContrast] = React.useState(0);
  const [format, setFormat] = React.useState<ImageFormat>(decoded.format);

  const untouched = brightness === 0 && contrast === 0;

  const process = () =>
    run(() => adjustImage(ctx.decoded, { brightness, contrast, format }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Slider
            min={-100}
            max={100}
            value={brightness}
            onValueChange={setBrightness}
            label={t('controls.brightness')}
            disabled={processing}
          />
          <Slider
            min={-100}
            max={100}
            value={contrast}
            onValueChange={setContrast}
            label={t('controls.contrast')}
            disabled={processing}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={processing || untouched}
              onClick={() => {
                setBrightness(0);
                setContrast(0);
              }}
            >
              {t('controls.resetAdjustments')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={processing}
              onClick={() => {
                setBrightness(15);
                setContrast(10);
              }}
            >
              {t('controls.autoEnhance')}
            </Button>
          </div>
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
          <ActionButton onClick={process} disabled={processing || untouched} processing={processing} className="w-full" success={results.length > 0 && !processing && !error}>
            {t('controls.applyAdjustments')}
          </ActionButton>
          <p className="text-xs text-muted-foreground">{t('controls.livePreviewNote')}</p>
        </ControlsCard>

        <EffectPreview
          decoded={decoded}
          effect={(data) => applyBrightnessContrast(data, brightness, contrast)}
          deps={[brightness, contrast]}
          alt={ctx.files[0]?.name}
        />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
