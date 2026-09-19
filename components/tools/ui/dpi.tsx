'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox } from './common';
import { Input } from '@/components/ui/input';

import { ActionButton } from '@/components/ui/action-button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { Notice } from '@/components/tools/kit';
import { printSizeCm, readDpi, writeDpi } from '@/lib/image/dpi';
import { nameOf } from '@/lib/image/process';

const COMMON = [72, 150, 300, 600];

function extOf(name: string): 'jpg' | 'png' | null {
  const lower = (name || '').toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'jpg';
  return null;
}

/**
 * Change the DPI metadata of a JPEG/PNG without touching a single pixel,
 * with a live print-size preview.
 */
export default function DpiTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [target, setTarget] = React.useState(300);
  const [current, setCurrent] = React.useState<{ dpiX: number; dpiY: number; source: string } | null>(null);
  const preview = useObjectUrl(ctx.files[0]);

  const file = ctx.files[0];
  const decoded = ctx.decoded[0];
  const ext = file ? extOf(file.name) : null;

  React.useEffect(() => {
    let cancelled = false;
    setCurrent(null);
    if (!file || !ext) return;
    (async () => {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const info = readDpi(bytes, ext);
        if (!cancelled && info) setCurrent(info);
      } catch {
        /* keep unknown — the tool still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file, ext]);

  const process = () => {
    if (!file || !ext) return;
    const dpi = Math.max(1, Math.min(2400, Math.round(Number(target) || 300)));
    setTarget(dpi);
    run(async () => {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const out = writeDpi(bytes, ext, dpi);
      const copy = new Uint8Array(out.length);
      copy.set(out);
      const blob = new Blob([copy.buffer as ArrayBuffer], {
        type: ext === 'png' ? 'image/png' : 'image/jpeg',
      });
      return [
        {
          blob,
          format: ext,
          name: `${nameOf(file)}-${dpi}dpi.${ext}`,
          originalSize: file.size,
        },
      ];
    });
  };

  const w = decoded?.width ?? 0;
  const h = decoded?.height ?? 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          {!ext ? (
            <Notice variant="warning">{t('dpi.onlyJpgPng')}</Notice>
          ) : (
            <>
              <div className="space-y-1.5">
                <label htmlFor="dpi-target" className="text-sm font-medium text-foreground">
                  {t('dpi.target')}
                </label>
                <Input
                  id="dpi-target"
                  type="number"
                  min={1}
                  max={2400}
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  disabled={processing}
                  inputMode="numeric"
                />
                <div className="flex flex-wrap gap-2 pt-1">
                  {COMMON.map((d) => (
                    <button
                      key={d}
                      type="button"
                      disabled={processing}
                      onClick={() => setTarget(d)}
                      className="rounded-full border border-input bg-background px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {d} DPI
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  {t('dpi.current')}:{' '}
                  <strong className="text-foreground">
                    {current ? `${current.dpiX} DPI` : t('dpi.unknown')}
                  </strong>
                </p>
                <p>
                  {t('dpi.pixels')}: {w} × {h} {t('controls.pixels')}
                </p>
                <p>
                  {t('dpi.printAt', { dpi: target })}:{' '}
                  <strong className="text-foreground">
                    {printSizeCm(w, target).toFixed(1)} × {printSizeCm(h, target).toFixed(1)} cm
                  </strong>
                </p>
              </div>
              <Notice variant="info">{t('dpi.honestNote')}</Notice>
              <ActionButton onClick={process} disabled={processing} processing={processing} success={results.length > 0 && !processing && !error} className="w-full">
                {t('dpi.apply', { dpi: target })}
              </ActionButton>
            </>
          )}
        </ControlsCard>

        <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={file?.size} onReset={ctx.reset} />
    </div>
  );
}
