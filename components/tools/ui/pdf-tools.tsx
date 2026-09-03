'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, Field, useObjectUrl } from './common';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { imagesToPdf } from '@/lib/tools/processors/pdf';
import { ReorderList } from './reorder-list';

type PageSize = 'a4' | 'letter' | 'fit';
type Orientation = 'portrait' | 'landscape';

export function ImageToPdfTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [pageSize, setPageSize] = React.useState<PageSize>('a4');
  const [orientation, setOrientation] = React.useState<Orientation>('portrait');
  const preview = useObjectUrl(ctx.files[0]);

  const process = () => run(() => imagesToPdf(ctx.decoded, { pageSize, orientation }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Field label={t('controls.pageSize')}>
            <Select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
              disabled={processing}
              options={[
                { value: 'a4', label: t('controls.a4') },
                { value: 'letter', label: t('controls.letter') },
                { value: 'fit', label: t('controls.fitToImage') },
              ]}
            />
          </Field>
          {pageSize !== 'fit' && (
            <Field label={t('controls.orientation')}>
              <Select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                disabled={processing}
                options={[
                  { value: 'portrait', label: t('controls.portrait') },
                  { value: 'landscape', label: t('controls.landscape') },
                ]}
              />
            </Field>
          )}
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.convert')} → PDF
          </Button>
        </ControlsCard>
        <div className="max-h-[420px] overflow-hidden rounded-xl border border-border bg-secondary/40">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={ctx.files[0]?.name} className="h-full w-full object-contain" />
          )}
        </div>
      </div>
      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}

export function ImagesToPdfTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [pageSize, setPageSize] = React.useState<PageSize>('a4');
  const [orientation, setOrientation] = React.useState<Orientation>('portrait');
  const [order, setOrder] = React.useState<number[]>([]);
  const [thumbs, setThumbs] = React.useState<Record<number, string>>({});

  React.useEffect(() => {
    setOrder(ctx.files.map((_, i) => i));
  }, [ctx.files]);

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

  const reorder = (from: number, to: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const orderedDecoded = order.map((i) => ctx.decoded[i]).filter(Boolean);
  const items = order.map((i) => ({
    id: `${ctx.files[i]?.name}-${i}`,
    name: ctx.files[i]?.name ?? '',
    url: thumbs[i] ?? '',
  }));

  const process = () => run(() => imagesToPdf(orderedDecoded, { pageSize, orientation }));

  return (
    <div className="space-y-5">
      <ControlsCard>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('controls.pageSize')}>
            <Select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value as PageSize)}
              disabled={processing}
              options={[
                { value: 'a4', label: t('controls.a4') },
                { value: 'letter', label: t('controls.letter') },
                { value: 'fit', label: t('controls.fitToImage') },
              ]}
            />
          </Field>
          {pageSize !== 'fit' && (
            <Field label={t('controls.orientation')}>
              <Select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                disabled={processing}
                options={[
                  { value: 'portrait', label: t('controls.portrait') },
                  { value: 'landscape', label: t('controls.landscape') },
                ]}
              />
            </Field>
          )}
          <div className="flex items-end">
            <Button onClick={process} disabled={processing} loading={processing} className="w-full">
              {t('controls.convert')} → PDF
            </Button>
          </div>
        </div>
      </ControlsCard>

      <p className="text-xs text-muted-foreground">{t('controls.dropReorder')}</p>
      <ReorderList items={items} onReorder={reorder} />

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} onReset={ctx.reset} />
    </div>
  );
}
