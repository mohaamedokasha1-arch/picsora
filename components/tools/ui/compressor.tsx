'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox } from './common';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { compressImages } from '@/lib/tools/processors/compressor';
import type { ImageFormat } from '@/lib/types';

export default function CompressorTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [quality, setQuality] = React.useState(80);
  const [format, setFormat] = React.useState<'same' | ImageFormat>('same');
  const preview = useObjectUrl(ctx.files[0]);

  const originalSize = ctx.files.reduce((sum, f) => sum + f.size, 0);

  const process = () => {
    run(() => compressImages(ctx.decoded, { quality, format }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Slider
            label={t('controls.quality')}
            min={1}
            max={100}
            value={quality}
            onValueChange={setQuality}
            valueSuffix="%"
            disabled={processing}
          />
          <div className="space-y-1.5">
            <label htmlFor="fmt" className="text-sm font-medium text-foreground">
              {t('toolShell.outputFormat')}
            </label>
            <Select
              id="fmt"
              value={format}
              onChange={(e) => setFormat(e.target.value as 'same' | ImageFormat)}
              disabled={processing}
              options={[
                { value: 'same', label: t('controls.outputSame') },
                { value: 'jpg', label: 'JPG' },
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WebP' },
              ]}
            />
          </div>
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.compress')}
          </Button>
        </ControlsCard>

        <div className="space-y-3">
          <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
        </div>
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={originalSize} onReset={ctx.reset} />
    </div>
  );
}
