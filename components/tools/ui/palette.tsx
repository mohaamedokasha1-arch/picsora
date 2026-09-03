'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, Field, useObjectUrl } from './common';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { extractPalette, type PaletteOutput } from '@/lib/tools/processors/palette';
import { copyText, triggerDownload } from '@/lib/image/format';
import { rgbToHex } from '@/lib/image/process';

export default function PaletteTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, error, run, setError } = useToolRunner();
  const [count, setCount] = React.useState(8);
  const [palette, setPalette] = React.useState<PaletteOutput | null>(null);
  const [copied, setCopied] = React.useState(false);
  const preview = useObjectUrl(ctx.files[0]);

  const extract = async () => {
    setPalette(null);
    setError(null);
    try {
      const out = await extractPalette(ctx.decoded, { count });
      setPalette(out);
    } catch {
      setError({ key: 'processingFailed' });
    }
  };

  const exportPng = () => {
    if (!palette) return;
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size * palette.colors.length + (palette.colors.length - 1) * 4;
    canvas.height = size;
    const cctx = canvas.getContext('2d');
    if (!cctx) return;
    palette.colors.forEach((c, i) => {
      cctx.fillStyle = c.hex;
      cctx.fillRect(i * (size + 4), 0, size, size);
    });
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, 'pixora-palette.png');
    }, 'image/png');
  };

  const exportJson = () => {
    if (!palette) return;
    const data = JSON.stringify(
      palette.colors.map((c) => ({ hex: c.hex, rgb: [c.r, c.g, c.b], share: Math.round(c.share * 100) / 100 })),
      null,
      2,
    );
    triggerDownload(new Blob([data], { type: 'application/json' }), 'pixora-palette.json');
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Field label={t('controls.colorCount')}>
            <Select
              value={String(count)}
              onChange={(e) => setCount(Number(e.target.value))}
              disabled={processing}
              options={[
                { value: '5', label: '5' },
                { value: '8', label: '8' },
                { value: '10', label: '10' },
              ]}
            />
          </Field>
          <Button onClick={extract} disabled={processing} loading={processing} className="w-full">
            {t('controls.apply')}
          </Button>
          {palette && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={exportPng}>
                <Download className="h-4 w-4" /> {t('controls.exportPng')}
              </Button>
              <Button variant="outline" size="sm" className="flex-1" onClick={exportJson}>
                <Download className="h-4 w-4" /> {t('controls.exportJson')}
              </Button>
            </div>
          )}
        </ControlsCard>

        <div className="space-y-4">
          {preview && (
            <div className="max-h-[260px] overflow-hidden rounded-xl border border-border bg-secondary/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt={ctx.files[0]?.name} className="h-full w-full object-contain" />
            </div>
          )}
          {processing && <ProcessingIndicator />}
          {error && <ErrorDisplay error={error} />}
          {palette && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {palette.colors.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={async () => {
                    if (await copyText(c.hex)) {
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1200);
                    }
                  }}
                  className="group overflow-hidden rounded-xl border border-border bg-card text-start shadow-sm transition-transform hover:-translate-y-0.5"
                  title={t('common.copy')}
                >
                  <div className="h-16 w-full" style={{ background: c.hex }} />
                  <div className="space-y-0.5 p-3">
                    <p className="font-mono text-sm font-semibold text-foreground">{copied ? '✓' : c.hex}</p>
                    <p className="text-xs text-muted-foreground">
                      {t('controls.rgb')}: {c.r}, {c.g}, {c.b}
                    </p>
                    <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-primary" style={{ width: `${Math.max(3, Math.round(c.share * 100))}%` }} />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <button type="button" onClick={ctx.reset} className="text-sm font-medium text-primary hover:underline">
        {t('toolShell.processAnother')}
      </button>
    </div>
  );
}
