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
import { cornerRadiusFor, roundedRectPath } from '@/lib/image/effects';
import { roundCorners } from '@/lib/tools/processors/effects';
import type { ImageFormat } from '@/lib/types';

export default function RoundedCornersTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [radiusPercent, setRadiusPercent] = React.useState(12);
  const [format, setFormat] = React.useState<ImageFormat>(
    decoded.format === 'png' || decoded.format === 'webp' ? decoded.format : 'png',
  );

  const keepsAlpha = format === 'png' || format === 'webp';

  const render = (
    canvasCtx: CanvasRenderingContext2D,
    width: number,
    height: number,
    source: CanvasImageSource,
  ) => {
    const radius = cornerRadiusFor(radiusPercent, width, height);
    canvasCtx.save();
    roundedRectPath(canvasCtx, 0, 0, width, height, radius);
    canvasCtx.clip();
    if (!keepsAlpha) {
      canvasCtx.fillStyle = '#ffffff';
      canvasCtx.fillRect(0, 0, width, height);
    }
    canvasCtx.drawImage(source, 0, 0, width, height);
    canvasCtx.restore();
  };

  const process = () => run(() => roundCorners(ctx.decoded, { radiusPercent, format }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Slider
            min={0}
            max={50}
            value={radiusPercent}
            onValueChange={setRadiusPercent}
            label={t('controls.cornerRadius')}
            valueSuffix="%"
            disabled={processing}
          />
          <Field label={t('toolShell.outputFormat')}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as ImageFormat)}
              disabled={processing}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WebP' },
                { value: 'jpg', label: 'JPG' },
              ]}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            {keepsAlpha ? t('controls.cornersTransparent') : t('controls.cornersWhite')}
          </p>
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.applyCorners')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('toolShell.originalSize')}: {decoded.width} × {decoded.height}
          </p>
        </ControlsCard>

        <EffectPreview
          decoded={decoded}
          render={render}
          deps={[radiusPercent, keepsAlpha]}
          alt={ctx.files[0]?.name}
        />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
