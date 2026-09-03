'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, Field, useObjectUrl } from './common';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { splitImage } from '@/lib/tools/processors/split';
import { triggerDownload } from '@/lib/image/format';

export default function SplitTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [cols, setCols] = React.useState(2);
  const [rows, setRows] = React.useState(2);
  const [zipping, setZipping] = React.useState(false);
  const preview = useObjectUrl(ctx.files[0]);

  const process = () => run(() => splitImage(ctx.decoded, { rows, cols, format: decoded.format }));

  const downloadZip = async () => {
    if (!results.length) return;
    setZipping(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      results.forEach((r) => zip.file(r.name, r.blob));
      const blob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(blob, `${decoded.file.name.replace(/\.[^.]+$/, '')}-tiles.zip`);
    } catch {
      /* shown as generic error below */
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('controls.columns')}>
              <Input type="number" min={1} max={20} value={cols} onChange={(e) => setCols(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} disabled={processing} />
            </Field>
            <Field label={t('controls.rows')}>
              <Input type="number" min={1} max={20} value={rows} onChange={(e) => setRows(Math.max(1, Math.min(20, Number(e.target.value) || 1)))} disabled={processing} />
            </Field>
          </div>
          {decoded && (
            <p className="text-xs text-muted-foreground">
              {t('controls.grid')}: {cols} × {rows} = {cols * rows} · ~{Math.floor(decoded.width / cols)} × {Math.floor(decoded.height / rows)} px
            </p>
          )}
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.split')}
          </Button>
        </ControlsCard>

        <div className="relative overflow-hidden rounded-xl border border-border bg-secondary/40">
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={ctx.files[0]?.name} className="h-full w-full object-contain" />
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(99,102,241,0.35) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.35) 1px, transparent 1px)',
              backgroundSize: `calc(100% / ${cols}) calc(100% / ${rows})`,
            }}
          />
        </div>
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}

      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-foreground">{t('toolShell.resultTitle')} ({results.length})</h3>
            <Button onClick={downloadZip} loading={zipping}>
              <Download className="h-4 w-4" />
              {t('controls.tilesNote')}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {results.map((r, i) => {
              const url = URL.createObjectURL(r.blob);
              return (
                <div key={i} className="overflow-hidden rounded-lg border border-border bg-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={r.name} className="aspect-square w-full object-cover" onLoad={() => setTimeout(() => URL.revokeObjectURL(url), 1000)} />
                  <div className="truncate px-2 py-1 text-[11px] text-muted-foreground">{r.name}</div>
                </div>
              );
            })}
          </div>
          <button type="button" onClick={ctx.reset} className="text-sm font-medium text-primary hover:underline">
            {t('toolShell.processAnother')}
          </button>
        </div>
      )}
    </div>
  );
}
