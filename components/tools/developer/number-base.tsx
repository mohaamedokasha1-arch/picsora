'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { convertBase, toBase } from '@/lib/developer-tools';
import { CopyButton, Field, InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const COMMON_BASES = [2, 8, 10, 16] as const;

export default function NumberBaseConverterTool() {
  const t = useTranslations();
  const [value, setValue] = React.useState('255');
  const [fromBase, setFromBase] = React.useState(10);
  const [customBase, setCustomBase] = React.useState(36);

  const result = React.useMemo(() => convertBase(value, fromBase), [value, fromBase]);
  const custom = React.useMemo(
    () => (result ? toBase(value, fromBase, customBase) : null),
    [result, value, fromBase, customBase],
  );

  const baseOptions = Array.from({ length: 35 }, (_, i) => i + 2).map((base) => ({
    value: String(base),
    label: `${t('dev.base')} ${base}`,
  }));

  const rows = result
    ? [
        { key: t('dev.binary'), sub: 'base 2', value: result.binary },
        { key: t('dev.octal'), sub: 'base 8', value: result.octal },
        { key: t('dev.decimal'), sub: 'base 10', value: result.decimal },
        { key: t('dev.hexUpper'), sub: 'base 16', value: result.hexUpper },
        { key: t('dev.hexLower'), sub: 'base 16', value: result.hexLower },
        { key: t('dev.byteGroups'), sub: '8-bit', value: result.bytes },
      ]
    : [];

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('toolShell.settingsTitle')}
        actions={
          <ResetButton
            onClick={() => {
              setValue('');
              setFromBase(10);
            }}
          />
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
          <Field label={t('dev.numberValue')}>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="255 · 0xFF · 1010"
              dir="ltr"
              inputMode="text"
              className="font-mono"
            />
          </Field>
          <Field label={t('dev.inputBase')}>
            <Select
              value={String(fromBase)}
              onChange={(e) => setFromBase(Number(e.target.value))}
              options={baseOptions}
            />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {COMMON_BASES.map((base) => (
            <button
              key={base}
              type="button"
              onClick={() => setFromBase(base)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                fromBase === base
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary'
              }`}
            >
              {t('dev.base')} {base}
            </button>
          ))}
        </div>

        {value.trim() && !result && (
          <div className="mt-3">
            <InlineError message={t('errors.invalidNumberForBase', { base: fromBase })} />
          </div>
        )}
      </ToolPanel>

      {result && (
        <ToolPanel title={t('textTools.output')}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase text-muted-foreground">
                    {row.key} · {row.sub}
                  </div>
                  <code dir="ltr" className="block break-all font-mono text-sm text-foreground">
                    {row.value}
                  </code>
                </div>
                <CopyButton value={row.value} size="icon-sm" variant="ghost" />
              </li>
            ))}
          </ul>
        </ToolPanel>
      )}

      {result && (
        <ToolPanel title={t('dev.customBase')}>
          <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
            <Field label={t('dev.targetBase')}>
              <Select
                value={String(customBase)}
                onChange={(e) => setCustomBase(Number(e.target.value))}
                options={baseOptions}
              />
            </Field>
            <Field label={t('textTools.output')}>
              <div className="flex items-center gap-2">
                <code
                  dir="ltr"
                  className="flex h-10 min-w-0 flex-1 items-center overflow-x-auto rounded-md border border-input bg-secondary/30 px-3 font-mono text-sm text-foreground"
                >
                  {custom ?? '—'}
                </code>
                <CopyButton value={custom ?? ''} size="icon-sm" variant="ghost" />
              </div>
            </Field>
          </div>
        </ToolPanel>
      )}

      <Notice>{t('dev.baseHint')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
