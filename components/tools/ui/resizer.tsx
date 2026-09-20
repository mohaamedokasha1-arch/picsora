'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox, Field } from './common';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

import { ActionButton } from '@/components/ui/action-button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { SOCIAL_PRESETS, resizeImage } from '@/lib/tools/processors/resizer';

const PRESETS = [
  { id: 'hd', label: '1920 × 1080', w: 1920, h: 1080 },
  { id: 'hd720', label: '1280 × 720', w: 1280, h: 720 },
  { id: 'svga', label: '800 × 600', w: 800, h: 600 },
  { id: 'sq512', label: '512 × 512', w: 512, h: 512 },
  { id: 'sq256', label: '256 × 256', w: 256, h: 256 },
];

export default function ResizerTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [width, setWidth] = React.useState(decoded?.width ?? 0);
  const [height, setHeight] = React.useState(decoded?.height ?? 0);
  const [locked, setLocked] = React.useState(true);
  const [preset, setPreset] = React.useState('custom');
  const initialized = React.useRef(false);

  React.useEffect(() => {
    if (decoded && !initialized.current) {
      setWidth(decoded.width);
      setHeight(decoded.height);
      initialized.current = true;
    }
  }, [decoded]);

  React.useEffect(() => {
    initialized.current = false;
  }, [ctx.files]);

  const preview = useObjectUrl(ctx.files[0]);

  const applyPreset = (value: string) => {
    setPreset(value);
    const generic = PRESETS.find((x) => x.id === value);
    if (generic) {
      setWidth(generic.w);
      setHeight(generic.h);
      return;
    }
    const social = SOCIAL_PRESETS.find((x) => x.id === value);
    if (social) {
      // Social sizes have a fixed aspect ratio — unlock so the exact
      // platform dimensions are applied instead of the old ratio.
      setLocked(false);
      setWidth(social.width);
      setHeight(social.height);
    }
  };

  const onWidthChange = (v: number) => {
    setPreset('custom');
    if (locked && decoded) {
      const ratio = decoded.height / decoded.width;
      setWidth(v);
      setHeight(Math.round(v * ratio));
    } else {
      setWidth(v);
    }
  };

  const onHeightChange = (v: number) => {
    setPreset('custom');
    if (locked && decoded) {
      const ratio = decoded.width / decoded.height;
      setHeight(v);
      setWidth(Math.round(v * ratio));
    } else {
      setHeight(v);
    }
  };

  const process = () => {
    const w = Math.max(1, Math.min(16000, Math.round(width || 1)));
    const h = Math.max(1, Math.min(16000, Math.round(height || 1)));
    run(() => resizeImage(ctx.decoded, { width: w, height: h, format: decoded.format }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Field label={t('controls.preset')}>
            <Select
              value={preset}
              onChange={(e) => applyPreset(e.target.value)}
              disabled={processing}
              options={[
                { value: 'custom', label: t('controls.custom') },
                ...PRESETS.map((p) => ({ value: p.id, label: p.label })),
                ...SOCIAL_PRESETS.map((p) => ({
                  value: p.id,
                  label: `${t(p.labelKey as never)} · ${p.width} × ${p.height}`,
                })),
              ]}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t('controls.width')} (${t('controls.pixels')})`}>
              <Input
                type="number"
                min={1}
                max={16000}
                value={width || ''}
                disabled={processing}
                onChange={(e) => onWidthChange(Number(e.target.value))}
              />
            </Field>
            <Field label={`${t('controls.height')} (${t('controls.pixels')})`}>
              <Input
                type="number"
                min={1}
                max={16000}
                value={height || ''}
                disabled={processing}
                onChange={(e) => onHeightChange(Number(e.target.value))}
              />
            </Field>
          </div>
          <Switch checked={locked} onCheckedChange={setLocked} label={t('controls.lockAspect')} />
          <p className="text-xs text-muted-foreground">
            {t('toolShell.originalSize')}: {decoded?.width} × {decoded?.height}
          </p>
          <ActionButton onClick={process} disabled={processing} processing={processing} success={results.length > 0 && !processing && !error} className="w-full">
            {t('controls.resize')}
          </ActionButton>
        </ControlsCard>

        <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
