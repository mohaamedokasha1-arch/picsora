'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, Field, useObjectUrl } from './common';
import { Slider } from '@/components/ui/slider';
import { Select } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { applyWatermark, type WatermarkPosition } from '@/lib/tools/processors/watermark';
import { decodeImage } from '@/lib/image/format';
import { cn } from '@/lib/utils';

const POSITIONS: { value: WatermarkPosition; key: string }[] = [
  { value: 'tl', key: 'positionTopLeft' },
  { value: 'tc', key: 'positionTopCenter' },
  { value: 'tr', key: 'positionTopRight' },
  { value: 'ml', key: 'positionMiddleLeft' },
  { value: 'c', key: 'positionCenter' },
  { value: 'mr', key: 'positionMiddleRight' },
  { value: 'bl', key: 'positionBottomLeft' },
  { value: 'bc', key: 'positionBottomCenter' },
  { value: 'br', key: 'positionBottomRight' },
];

export default function WatermarkTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const [type, setType] = React.useState<'text' | 'image'>('text');
  const [text, setText] = React.useState('© Piclizer');
  const [fontSize, setFontSize] = React.useState(48);
  const [fontFamily, setFontFamily] = React.useState('Arial, sans-serif');
  const [color, setColor] = React.useState('#ffffff');
  const [opacity, setOpacity] = React.useState(60);
  const [position, setPosition] = React.useState<WatermarkPosition>('br');
  const [tile, setTile] = React.useState(false);
  const [wmFile, setWmFile] = React.useState<File | null>(null);
  const [wmScale, setWmScale] = React.useState(20);
  const previewRef = React.useRef<HTMLCanvasElement>(null);
  const wmInputRef = React.useRef<HTMLInputElement>(null);

  // Live preview
  React.useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !decoded) return;
    const render = async () => {
      try {
        const { blob } = await applyWatermark([decoded], {
          type,
          text,
          fontFamily,
          fontSize,
          color,
          opacity,
          position,
          tile,
          format: 'png',
          watermarkFile: wmFile ?? undefined,
          watermarkScale: wmScale,
        });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 520 / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const cctx = canvas.getContext('2d');
          if (cctx) {
            cctx.clearRect(0, 0, canvas.width, canvas.height);
            cctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          }
          URL.revokeObjectURL(url);
        };
        img.src = url;
      } catch {
        /* ignore preview errors */
      }
    };
    const id = setTimeout(render, 120);
    return () => clearTimeout(id);
  }, [decoded, type, text, fontFamily, fontSize, color, opacity, position, tile, wmFile, wmScale]);

  const process = () =>
    run(() =>
      applyWatermark(ctx.decoded, {
        type,
        text,
        fontFamily,
        fontSize,
        color,
        opacity,
        position,
        tile,
        format: decoded.format,
        watermarkFile: wmFile ?? undefined,
        watermarkScale: wmScale,
      }),
    );

  const onWmFile = async (file: File | null) => {
    if (!file) {
      setWmFile(null);
      return;
    }
    try {
      await decodeImage(file);
      setWmFile(file);
    } catch {
      /* invalid file — ignore */
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Field label={t('controls.watermarkType')}>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as 'text' | 'image')}
              disabled={processing}
              options={[
                { value: 'text', label: t('controls.text') },
                { value: 'image', label: t('controls.image') },
              ]}
            />
          </Field>

          {type === 'text' ? (
            <>
              <Field label={t('controls.watermarkText')}>
                <Input value={text} onChange={(e) => setText(e.target.value)} disabled={processing} maxLength={200} />
              </Field>
              <Slider label={t('controls.fontSize')} min={12} max={200} value={fontSize} onValueChange={setFontSize} valueSuffix="px" disabled={processing} />
              <Field label={t('controls.fontFamily')}>
                <Select
                  value={fontFamily}
                  onChange={(e) => setFontFamily(e.target.value)}
                  disabled={processing}
                  options={[
                    { value: 'Arial, sans-serif', label: 'Arial' },
                    { value: 'Georgia, serif', label: 'Georgia' },
                    { value: '"Times New Roman", serif', label: 'Times New Roman' },
                    { value: '"Courier New", monospace', label: 'Courier New' },
                    { value: 'Impact, sans-serif', label: 'Impact' },
                    { value: 'Verdana, sans-serif', label: 'Verdana' },
                  ]}
                />
              </Field>
              <Field label={t('controls.color')}>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    disabled={processing}
                    aria-label={t('controls.color')}
                    className="h-10 w-14 cursor-pointer rounded-md border border-input bg-background"
                  />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} disabled={processing} aria-label={t('controls.color')} />
                </div>
              </Field>
            </>
          ) : (
            <>
              <Field label={t('controls.watermarkImage')}>
                <Button variant="outline" className="w-full" onClick={() => wmInputRef.current?.click()} disabled={processing}>
                  {wmFile ? wmFile.name : t('controls.addImageWatermark')}
                </Button>
                <input
                  ref={wmInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => onWmFile(e.target.files?.[0] ?? null)}
                />
              </Field>
              <Slider label={t('controls.size')} min={5} max={100} value={wmScale} onValueChange={setWmScale} valueSuffix="%" disabled={processing} />
            </>
          )}

          <Slider label={t('controls.opacity')} min={1} max={100} value={opacity} onValueChange={setOpacity} valueSuffix="%" disabled={processing} />
          <Switch checked={tile} onCheckedChange={setTile} label={t('controls.tile')} disabled={processing} />

          {!tile && (
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('controls.position')}>
              {POSITIONS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="radio"
                  aria-checked={position === p.value}
                  title={t(`controls.${p.key}` as never)}
                  onClick={() => setPosition(p.value)}
                  className={cn(
                    'flex h-9 items-center justify-center rounded-md border border-input text-xs transition-colors',
                    position === p.value ? 'border-primary bg-primary text-primary-foreground' : 'bg-background hover:bg-accent',
                  )}
                >
                  {t(`controls.${p.key}` as never)}
                </button>
              ))}
            </div>
          )}

          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.apply')}
          </Button>
        </ControlsCard>

        <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-border bg-secondary/40 p-4">
          <canvas ref={previewRef} className="max-w-full" aria-label={t('toolShell.beforeAfter')} />
        </div>
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
