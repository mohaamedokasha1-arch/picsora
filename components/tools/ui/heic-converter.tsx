'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox, Field } from './common';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { convertMany } from '@/lib/tools/processors/convert';
import type { ImageFormat } from '@/lib/types';

interface HeicConfig {
  to: ImageFormat;
  needsBackground?: boolean;
}

/**
 * HEIC → JPG/PNG. By the time this runs, the workspace has already decoded
 * the iPhone photo locally (heic2any) with EXIF orientation applied, so the
 * standard converter pipeline is all that is needed.
 */
function HeicConverterTool({ ctx, config }: { ctx: WorkspaceContext; config: HeicConfig }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [quality, setQuality] = React.useState(90);
  const [background, setBackground] = React.useState('#ffffff');
  const preview = useObjectUrl(ctx.files[0]);

  const isLossy = config.to === 'jpg' || config.to === 'webp';
  const originalSize = ctx.files.reduce((s, f) => s + f.size, 0);

  const process = () => {
    run(() => convertMany(ctx.decoded, { format: config.to, quality, background }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
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
          {config.needsBackground && (
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
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.convert')} → {config.to.toUpperCase()}
          </Button>
        </ControlsCard>

        <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={originalSize} onReset={ctx.reset} />
    </div>
  );
}

export function HeicToJpgTool({ ctx }: { ctx: WorkspaceContext }) {
  return <HeicConverterTool ctx={ctx} config={{ to: 'jpg', needsBackground: true }} />;
}

export function HeicToPngTool({ ctx }: { ctx: WorkspaceContext }) {
  return <HeicConverterTool ctx={ctx} config={{ to: 'png' }} />;
}
