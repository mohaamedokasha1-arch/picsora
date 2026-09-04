'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox } from './common';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { Notice } from '@/components/tools/kit';
import { compressToExactSize, type ExactSizeResult } from '@/lib/tools/processors/exact-size';
import type { ImageFormat } from '@/lib/types';
import { formatBytes } from '@/lib/utils';

const PRESETS = [50, 100, 200, 500, 1024];

/** Compress images to an exact file-size target (e.g. exactly 100 KB). */
export default function ExactKbTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [targetKB, setTargetKB] = React.useState(100);
  const [format, setFormat] = React.useState<ImageFormat>('jpg');
  const preview = useObjectUrl(ctx.files[0]);

  const originalSize = ctx.files.reduce((sum, f) => sum + f.size, 0);

  const process = () => {
    const kb = Math.max(5, Math.min(51200, Math.round(Number(targetKB) || 100)));
    setTargetKB(kb);
    run(() => compressToExactSize(ctx.decoded, { targetKB: kb, format }));
  };

  const typed = results as ExactSizeResult[];
  const allHit = typed.length > 0 && typed.every((r) => r.hit);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <div className="space-y-1.5">
            <label htmlFor="exact-kb" className="text-sm font-medium text-foreground">
              {t('controls.targetSize')} (KB)
            </label>
            <Input
              id="exact-kb"
              type="number"
              min={5}
              max={51200}
              value={targetKB}
              onChange={(e) => setTargetKB(Number(e.target.value))}
              disabled={processing}
              inputMode="numeric"
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={processing}
                  onClick={() => setTargetKB(p)}
                  className="rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                >
                  {p} KB
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="exact-fmt" className="text-sm font-medium text-foreground">
              {t('toolShell.outputFormat')}
            </label>
            <Select
              id="exact-fmt"
              value={format}
              onChange={(e) => setFormat(e.target.value as ImageFormat)}
              disabled={processing}
              options={[
                { value: 'jpg', label: 'JPG' },
                { value: 'png', label: 'PNG' },
                { value: 'webp', label: 'WebP' },
              ]}
            />
          </div>
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.compress')} → {targetKB} KB
          </Button>
        </ControlsCard>

        <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      {typed.length > 0 && (
        <Notice variant={allHit ? 'privacy' : 'warning'}>
          {allHit
            ? t('exactKb.hitNote', { size: formatBytes(typed[0].outputSize) })
            : t('exactKb.missNote', { size: formatBytes(typed[0].outputSize) })}
        </Notice>
      )}
      <ResultPanel results={results} originalSize={originalSize} onReset={ctx.reset} />
    </div>
  );
}
