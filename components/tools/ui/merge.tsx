'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, Field, useObjectUrl } from './common';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { mergeImages } from '@/lib/tools/processors/merge';
import { ReorderList } from './reorder-list';
import type { ImageFormat } from '@/lib/types';

export default function MergeTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [direction, setDirection] = React.useState<'horizontal' | 'vertical'>('horizontal');
  const [spacing, setSpacing] = React.useState(0);
  const [background, setBackground] = React.useState('#ffffff');
  const [format, setFormat] = React.useState<ImageFormat>('png');
  const [order, setOrder] = React.useState<number[]>([]);
  const [thumbs, setThumbs] = React.useState<Record<number, string>>({});

  React.useEffect(() => setOrder(ctx.files.map((_, i) => i)), [ctx.files]);
  React.useEffect(() => {
    const urls: string[] = [];
    const map: Record<number, string> = {};
    ctx.files.forEach((f, i) => {
      if (f.type.startsWith('image/')) {
        const u = URL.createObjectURL(f);
        urls.push(u);
        map[i] = u;
      }
    });
    setThumbs(map);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [ctx.files]);

  const reorder = (from: number, to: number) =>
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  const orderedDecoded = order.map((i) => ctx.decoded[i]).filter(Boolean);

  const process = () =>
    run(() => mergeImages(orderedDecoded, { direction, spacing, background, format }));

  const items = order.map((i) => ({ id: `${ctx.files[i]?.name}-${i}`, name: ctx.files[i]?.name ?? '', url: thumbs[i] ?? '' }));

  return (
    <div className="space-y-5">
      <ControlsCard>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('controls.direction')}>
            <Select
              value={direction}
              onChange={(e) => setDirection(e.target.value as 'horizontal' | 'vertical')}
              disabled={processing}
              options={[
                { value: 'horizontal', label: t('controls.horizontal') },
                { value: 'vertical', label: t('controls.vertical') },
              ]}
            />
          </Field>
          <Field label={t('controls.format')}>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as ImageFormat)}
              disabled={processing}
              options={[
                { value: 'png', label: 'PNG' },
                { value: 'jpg', label: 'JPG' },
              ]}
            />
          </Field>
          <div className="col-span-2">
            <Slider label={t('controls.spacing')} min={0} max={200} value={spacing} onValueChange={setSpacing} valueSuffix="px" disabled={processing} />
          </div>
        </div>
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
            <Input value={background} onChange={(e) => setBackground(e.target.value)} disabled={processing} aria-label={t('controls.background')} />
          </div>
        </Field>
        <Button onClick={process} disabled={processing} loading={processing} className="w-full">
          {t('controls.merge')}
        </Button>
      </ControlsCard>

      <p className="text-xs text-muted-foreground">{t('controls.dropReorder')}</p>
      <ReorderList items={items} onReorder={reorder} />

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} onReset={ctx.reset} />
    </div>
  );
}
