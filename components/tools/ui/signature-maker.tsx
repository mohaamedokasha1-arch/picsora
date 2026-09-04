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
import { CheckboxRow, Notice } from '@/components/tools/kit';
import { makeSignature } from '@/lib/tools/processors/signature';

const INKS = ['#000000', '#0b3d91', '#b00020'];

/** Turn a photo of a handwritten signature into a clean transparent PNG. */
export default function SignatureMakerTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [threshold, setThreshold] = React.useState(62);
  const [ink, setInk] = React.useState('#000000');
  const [invert, setInvert] = React.useState(false);
  const preview = useObjectUrl(ctx.files[0]);

  const originalSize = ctx.files.reduce((sum, f) => sum + f.size, 0);

  const process = () => {
    run(() => makeSignature(ctx.decoded, { threshold, ink, invert }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Slider
            label={t('controls.threshold')}
            min={1}
            max={100}
            value={threshold}
            onValueChange={setThreshold}
            valueSuffix="%"
            disabled={processing}
          />
          <Field label={t('controls.inkColor')}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={ink}
                onChange={(e) => setInk(e.target.value)}
                disabled={processing}
                aria-label={t('controls.inkColor')}
                className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
              />
              <Input
                value={ink}
                onChange={(e) => setInk(e.target.value)}
                disabled={processing}
                className="flex-1"
                aria-label={t('controls.inkColor')}
              />
            </div>
            <div className="flex gap-2 pt-2">
              {INKS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={processing}
                  onClick={() => setInk(c)}
                  aria-label={c}
                  style={{ backgroundColor: c }}
                  className="h-7 w-7 rounded-full border border-input"
                />
              ))}
            </div>
          </Field>
          <CheckboxRow checked={invert} onChange={setInvert} label={t('controls.invertColors')} />
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('signature.make')}
          </Button>
        </ControlsCard>

        <div className="space-y-3">
          <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
          <Notice>{t('signature.hint')}</Notice>
        </div>
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={originalSize} onReset={ctx.reset} />
    </div>
  );
}
