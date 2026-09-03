'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { allFormats, parseColor, shades, toHex, wcag, type Rgba } from '@/lib/developer-tools/color';
import { CopyButton, Field, InlineError, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const BLACK: Rgba = { r: 0, g: 0, b: 0, a: 1 };

export default function ColorConverterTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('#3b82f6');

  const color = React.useMemo(() => parseColor(input), [input]);
  const formats = color ? allFormats(color) : null;
  const palette = color ? shades(color) : [];
  const onWhite = color ? wcag(color, WHITE) : null;
  const onBlack = color ? wcag(color, BLACK) : null;

  const rows: { key: string; value: string }[] = formats
    ? [
        { key: 'HEX', value: formats.hex },
        { key: 'HEX+A', value: formats.hexAlpha },
        { key: 'RGB', value: formats.rgb },
        { key: 'RGBA', value: formats.rgba },
        { key: 'HSL', value: formats.hsl },
        { key: 'HSLA', value: formats.hsla },
        { key: 'HSV', value: formats.hsv },
        { key: 'CMYK', value: formats.cmyk },
        ...(formats.name ? [{ key: t('dev.namedColor'), value: formats.name }] : []),
      ]
    : [];

  const badge = (ok: boolean, label: string) => (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold',
        ok
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          : 'bg-destructive/15 text-destructive',
      )}
    >
      {label} {ok ? '✓' : '✗'}
    </span>
  );

  return (
    <div className="space-y-5">
      <ToolPanel title={t('dev.colorInput')} actions={<ResetButton onClick={() => setInput('#3b82f6')} />}>
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label={t('dev.anyFormat')}>
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="#3b82f6 · rgb(59,130,246) · hsl(217,91%,60%) · tomato"
              dir="ltr"
              className="font-mono"
            />
          </Field>
          <Field label={t('dev.colorPicker')}>
            <input
              type="color"
              value={color ? toHex(color) : '#000000'}
              onChange={(e) => setInput(e.target.value)}
              aria-label={t('dev.colorPicker')}
              className="h-10 w-16 cursor-pointer rounded-md border border-input bg-background"
            />
          </Field>
        </div>

        {input && !color && <div className="mt-3"><InlineError message={t('errors.invalidColor')} /></div>}

        {color && (
          <div
            className="mt-4 flex h-28 items-end rounded-xl border border-border p-3 shadow-inner"
            style={{ backgroundColor: formats?.rgba }}
          >
            <span
              className="rounded-md bg-black/50 px-2 py-1 font-mono text-sm font-semibold text-white"
              style={{ backdropFilter: 'blur(2px)' }}
            >
              {formats?.hex}
            </span>
          </div>
        )}
      </ToolPanel>

      {formats && (
        <ToolPanel title={t('dev.allFormats')}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase text-muted-foreground">{row.key}</div>
                  <code dir="ltr" className="block truncate font-mono text-sm text-foreground">
                    {row.value}
                  </code>
                </div>
                <CopyButton value={row.value} size="icon-sm" variant="ghost" />
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}

      {onWhite && onBlack && (
        <ToolPanel title={t('dev.contrast')}>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: t('dev.onWhite'), verdict: onWhite, bg: '#ffffff', fg: formats!.hex },
              { label: t('dev.onBlack'), verdict: onBlack, bg: '#000000', fg: formats!.hex },
            ].map((entry) => (
              <div key={entry.label} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{entry.label}</span>
                  <span className="font-mono text-sm tabular-nums text-foreground">
                    {entry.verdict.ratio.toFixed(2)}:1
                  </span>
                </div>
                <div
                  className="mt-2 rounded-md p-3 text-center text-sm font-semibold"
                  style={{ backgroundColor: entry.bg, color: entry.fg }}
                >
                  {t('dev.sampleText')}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {badge(entry.verdict.aaNormal, 'AA')}
                  {badge(entry.verdict.aaLarge, 'AA Large')}
                  {badge(entry.verdict.aaaNormal, 'AAA')}
                  {badge(entry.verdict.aaaLarge, 'AAA Large')}
                </div>
              </div>
            ))}
          </div>
        </ToolPanel>
      )}

      {palette.length > 0 && (
        <ToolPanel title={t('dev.shades')}>
          <ul className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {palette.map((shade) => (
              <li key={shade}>
                <button
                  type="button"
                  onClick={() => setInput(shade)}
                  className="block h-16 w-full rounded-lg border border-border transition-transform hover:scale-105"
                  style={{ backgroundColor: shade }}
                  aria-label={shade}
                  title={shade}
                />
                <code dir="ltr" className="mt-1 block text-center font-mono text-[10px] text-muted-foreground">
                  {shade}
                </code>
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}

      <PrivacyNotice />
    </div>
  );
}
