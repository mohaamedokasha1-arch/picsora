'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from '@/components/tools/ui/use-tool';
import { compressToExactKb, type ExactKbResult } from '@/lib/tools/processors/exact-kb';
import { ResultPanel } from '@/components/tools/result-panel';
import { ControlsCard, Field } from '@/components/tools/ui/common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { formatBytes } from '@/lib/utils';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';

export function ExactKbCompressorUI({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const [targetKB, setTargetKB] = React.useState<number>(500);
  const [format, setFormat] = React.useState<'same' | 'jpg' | 'webp'>('same');
  const { run, results, processing, progress, progressText, clear } = useToolRunner();

  React.useEffect(() => {
    clear();
  }, [ctx.files, clear]);

  const onCompress = () => {
    run(async (updateProgress) => {
      return compressToExactKb(ctx.decoded, { targetKB, format }, updateProgress);
    });
  };

  const kbPresets = [
    { label: '50 KB', value: 50 },
    { label: '100 KB', value: 100 },
    { label: '200 KB', value: 200 },
    { label: '500 KB', value: 500 },
    { label: '1 MB (1024 KB)', value: 1024 },
    { label: '2 MB (2048 KB)', value: 2048 },
  ];

  const exactResults = results as unknown as ExactKbResult[];

  return (
    <div className="space-y-6">
      <ControlsCard>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('controls.targetSizeKb') || 'Target File Size (KB)'} hint={t('controls.targetSizeHint') || 'Enter desired size in kilobytes'}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={50000}
                step={10}
                value={targetKB}
                onChange={(e) => setTargetKB(Math.max(1, Number(e.target.value) || 100))}
                className="w-36 font-semibold"
              />
              <span className="text-sm font-medium text-muted-foreground">KB</span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {kbPresets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setTargetKB(p.value)}
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    targetKB === p.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-secondary/50 text-foreground hover:bg-accent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label={t('controls.outputFormat') || 'Output Format'}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as 'same' | 'jpg' | 'webp')}
            >
              <option value="same">{t('controls.sameAsOriginal') || 'Same as original'}</option>
              <option value="jpg">JPG (Best for photos)</option>
              <option value="webp">WebP (Smallest file size)</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">
            {ctx.files.length} {ctx.files.length === 1 ? 'file' : 'files'} selected · Total: {formatBytes(ctx.files.reduce((a, b) => a + b.size, 0))}
          </div>
          <Button onClick={onCompress} disabled={processing || ctx.files.length === 0} size="lg">
            {processing ? t('common.processing') : `${t('common.process')} → Target ${targetKB} KB`}
          </Button>
        </div>
      </ControlsCard>

      {processing && (
        <ProcessingIndicator progress={progress} />
      )}

      {exactResults.length > 0 && !processing && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {exactResults.map((res, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate font-medium text-foreground">{res.name}</span>
                  <span className={res.reachedTarget ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-amber-600 dark:text-amber-400'}>
                    {res.reachedTarget ? '✓ Target reached' : 'Closest match'}
                  </span>
                </div>
                <div className="flex items-baseline justify-between pt-1">
                  <div>
                    <span className="text-xs text-muted-foreground block">Original</span>
                    <span className="text-sm line-through text-muted-foreground">{formatBytes(res.originalSize)}</span>
                  </div>
                  <div className="text-end">
                    <span className="text-xs text-muted-foreground block">Result (Target: {targetKB} KB)</span>
                    <span className="text-lg font-bold text-primary">{formatBytes(res.outputSize)}</span>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground border-t border-border pt-2 flex justify-between">
                  <span>Quality: {res.finalQuality}%</span>
                  <span>Scale: {res.scaleFactor}%</span>
                </div>
              </div>
            ))}
          </div>

          <ResultPanel results={results} onReset={ctx.reset} />
        </div>
      )}
    </div>
  );
}
