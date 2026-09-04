'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox } from './common';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { Notice, ToggleGroup } from '@/components/tools/kit';
import { removeBackground } from '@/lib/tools/processors/background';

type Source = 'corners' | 'white';

/** Local chroma-key background remover — best on solid backgrounds. */
export default function BackgroundRemoverTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [tolerance, setTolerance] = React.useState(32);
  const [feather, setFeather] = React.useState(35);
  const [source, setSource] = React.useState<Source>('corners');
  const preview = useObjectUrl(ctx.files[0]);

  const originalSize = ctx.files.reduce((sum, f) => sum + f.size, 0);

  const process = () => {
    run(() => removeBackground(ctx.decoded, { tolerance, feather, source }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <ToggleGroup<Source>
            label={t('controls.bgSource')}
            value={source}
            onChange={setSource}
            options={[
              { value: 'corners', label: t('controls.bgAuto') },
              { value: 'white', label: t('controls.bgWhite') },
            ]}
          />
          <Slider
            label={t('controls.tolerance')}
            min={1}
            max={100}
            value={tolerance}
            onValueChange={setTolerance}
            valueSuffix="%"
            disabled={processing}
          />
          <Slider
            label={t('controls.feather')}
            min={0}
            max={100}
            value={feather}
            onValueChange={setFeather}
            valueSuffix="%"
            disabled={processing}
          />
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.removeBg')}
          </Button>
        </ControlsCard>

        <div className="space-y-3">
          <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
          <Notice>{t('bgRemover.hint')}</Notice>
        </div>
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={originalSize} onReset={ctx.reset} />
    </div>
  );
}
