'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox, Field } from './common';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { toGrayscale } from '@/lib/tools/processors/grayscale';
import type { ImageFormat } from '@/lib/types';

export default function GrayscaleTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [format, setFormat] = React.useState<'same' | ImageFormat>('same');
  const preview = useObjectUrl(ctx.files[0]);

  const process = () =>
    run(() => toGrayscale(ctx.decoded, { format: format === 'same' ? decoded.format : format }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Field label={t('toolShell.outputFormat')}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'same' | ImageFormat)}
              disabled={processing}
              options={[
                { value: 'same', label: t('controls.outputSame') },
                { value: 'png', label: 'PNG' },
              ]}
            />
          </Field>
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.grayscale')}
          </Button>
        </ControlsCard>
        <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px] grayscale" />
      </div>
      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
