'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, Field } from './common';
import { EffectPreview, RegionList } from './effect-preview';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { ToggleGroup } from '@/components/tools/kit';
import { pixelBlockFor, pixelateRect, toPixelRects, type NormRect } from '@/lib/image/effects';
import { pixelateImage } from '@/lib/tools/processors/effects';
import type { ImageFormat } from '@/lib/types';

export default function ImagePixelateTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [mode, setMode] = React.useState<'whole' | 'areas'>('whole');
  const [blockSize, setBlockSize] = React.useState(16);
  const [regions, setRegions] = React.useState<NormRect[]>([]);
  const [format, setFormat] = React.useState<ImageFormat>(decoded.format);

  const areas = mode === 'areas' ? regions : [];

  const preview = (data: Uint8ClampedArray, width: number, height: number) => {
    const block = pixelBlockFor(blockSize, Math.max(width, height));
    if (!areas.length) {
      if (mode === 'whole') pixelateRect(data, width, height, null, block);
      return;
    }
    for (const rect of toPixelRects(areas, width, height)) {
      pixelateRect(data, width, height, rect, block);
    }
  };

  const process = () => run(() => pixelateImage(ctx.decoded, { blockSize, format, regions: areas }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <ToggleGroup
            value={mode}
            onChange={(value) => setMode(value)}
            label={t('controls.pixelateMode')}
            options={[
              { value: 'whole', label: t('controls.wholeImage') },
              { value: 'areas', label: t('controls.modeSelectedAreas') },
            ]}
          />
          <Slider
            min={4}
            max={64}
            step={2}
            value={blockSize}
            onValueChange={setBlockSize}
            label={t('controls.pixelSize')}
            valueSuffix=" px"
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
          <Button
            onClick={process}
            disabled={processing || (mode === 'areas' && !regions.length)}
            loading={processing}
            className="w-full"
          >
            {t('controls.applyPixelate')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t('toolShell.originalSize')}: {decoded.width} × {decoded.height}
          </p>
        </ControlsCard>

        <div className="space-y-4">
          <EffectPreview
            decoded={decoded}
            effect={preview}
            deps={[blockSize, mode, regions]}
            regions={mode === 'areas' ? regions : []}
            onRegionsChange={mode === 'areas' ? setRegions : undefined}
            selectable={mode === 'areas'}
            alt={ctx.files[0]?.name}
          />
          {mode === 'areas' && (
            <RegionList regions={regions} onRegionsChange={setRegions} disabled={processing} />
          )}
        </div>
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
