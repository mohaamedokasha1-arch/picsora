'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox, Field } from './common';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { ToggleGroup } from '@/components/tools/kit';
import { PASSPORT_PRESETS, makePassportPhoto } from '@/lib/tools/processors/passport';

/** Build a print-ready ID / passport photo at exact mm dimensions. */
export default function PassportPhotoTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [presetId, setPresetId] = React.useState('35x45');
  const [dpi, setDpi] = React.useState<'300' | '600'>('300');
  const [background, setBackground] = React.useState('#ffffff');
  const [format, setFormat] = React.useState<'jpg' | 'png'>('jpg');
  const preview = useObjectUrl(ctx.files[0]);

  const originalSize = ctx.files.reduce((sum, f) => sum + f.size, 0);
  const preset = PASSPORT_PRESETS.find((p) => p.id === presetId) ?? PASSPORT_PRESETS[0];
  const outW = Math.round((preset.wMm / 25.4) * Number(dpi));
  const outH = Math.round((preset.hMm / 25.4) * Number(dpi));

  const process = () => {
    run(() =>
      makePassportPhoto(ctx.decoded, {
        presetId,
        dpi: Number(dpi) as 300 | 600,
        background,
        format,
      }),
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <div className="space-y-1.5">
            <label htmlFor="pp-preset" className="text-sm font-medium text-foreground">
              {t('controls.preset')}
            </label>
            <Select
              id="pp-preset"
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              disabled={processing}
              options={PASSPORT_PRESETS.map((p) => ({
                value: p.id,
                label: t(`passport.preset_${p.id}` as never),
              }))}
            />
          </div>
          <ToggleGroup<'300' | '600'>
            label={t('controls.dpi')}
            value={dpi}
            onChange={setDpi}
            options={[
              { value: '300', label: '300 DPI' },
              { value: '600', label: '600 DPI' },
            ]}
          />
          <div className="space-y-1.5">
            <label htmlFor="pp-fmt" className="text-sm font-medium text-foreground">
              {t('toolShell.outputFormat')}
            </label>
            <Select
              id="pp-fmt"
              value={format}
              onChange={(e) => setFormat(e.target.value as 'jpg' | 'png')}
              disabled={processing}
              options={[
                { value: 'jpg', label: 'JPG' },
                { value: 'png', label: 'PNG' },
              ]}
            />
          </div>
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
          <p className="text-xs text-muted-foreground">
            {t('passport.outputSize', { w: outW, h: outH })}
          </p>
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('passport.make')}
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
