'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import {
  applyPercent,
  isWhatPercentOf,
  originalBeforePercent,
  percentChange,
  percentageOf,
  type PercentMode,
  type PercentResult,
} from '@/lib/calculators';
import { CopyButton, Field, Notice, PrivacyNotice, ResetButton, ToggleGroup, ToolPanel, useDebounced } from '../kit';

const MODES: PercentMode[] = ['ofValue', 'isWhatPercent', 'change', 'increaseDecrease', 'original'];

export default function PercentageCalculatorTool() {
  const t = useTranslations();
  const [mode, setMode] = React.useState<PercentMode>('ofValue');
  const [a, setA] = React.useState('');
  const [b, setB] = React.useState('');
  const [direction, setDirection] = React.useState<'increase' | 'decrease'>('increase');

  const da = useDebounced(a, 200);
  const db = useDebounced(b, 200);

  const result = React.useMemo<PercentResult | null>(() => {
    const x = Number(da);
    const y = Number(db);
    if (da === '' || db === '' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
    switch (mode) {
      case 'ofValue':
        return percentageOf(x, y);
      case 'isWhatPercent':
        return isWhatPercentOf(x, y);
      case 'change':
        return percentChange(x, y);
      case 'increaseDecrease':
        return applyPercent(x, y, direction);
      case 'original':
        return originalBeforePercent(x, y, direction);
      default:
        return null;
    }
  }, [mode, da, db, direction]);

  const labels: Record<PercentMode, [string, string]> = {
    ofValue: [t('calc.pctPercent'), t('calc.pctTotal')],
    isWhatPercent: [t('calc.pctPart'), t('calc.pctTotal')],
    change: [t('calc.pctFrom'), t('calc.pctTo')],
    increaseDecrease: [t('calc.pctBase'), t('calc.pctPercent')],
    original: [t('calc.pctResult'), t('calc.pctPercent')],
  };

  const suffix = mode === 'isWhatPercent' || mode === 'change' ? '%' : '';

  return (
    <div className="space-y-5">
      <ToolPanel title={t('calc.chooseMode')}>
        <ToggleGroup
          value={mode}
          onChange={(value) => {
            setMode(value);
            setA('');
            setB('');
          }}
          options={MODES.map((value) => ({ value, label: t(`calc.pctMode_${value}` as never) }))}
        />
        <p className="mt-3 text-sm text-muted-foreground">{t(`calc.pctModeDesc_${mode}` as never)}</p>
      </ToolPanel>

      <ToolPanel title={t('calc.values')} actions={<ResetButton onClick={() => { setA(''); setB(''); }} />}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels[mode][0]}>
            <Input type="number" value={a} onChange={(e) => setA(e.target.value)} dir="ltr" />
          </Field>
          <Field label={labels[mode][1]}>
            <Input type="number" value={b} onChange={(e) => setB(e.target.value)} dir="ltr" />
          </Field>
        </div>

        {(mode === 'increaseDecrease' || mode === 'original') && (
          <div className="mt-4">
            <ToggleGroup
              label={t('calc.direction')}
              value={direction}
              onChange={setDirection}
              options={[
                { value: 'increase', label: t('calc.increase') },
                { value: 'decrease', label: t('calc.decrease') },
              ]}
            />
          </div>
        )}
      </ToolPanel>

      {result && (
        <ToolPanel
          title={t('calc.result')}
          actions={result.value !== null ? <CopyButton value={String(Number(result.value.toFixed(6)))} /> : undefined}
        >
          {result.value === null ? (
            <>
              <p className="text-2xl font-bold text-foreground">{t('calc.undefined')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('errors.divideByZero')}</p>
            </>
          ) : (
            <p className="text-3xl font-bold tabular-nums text-foreground" dir="ltr">
              {Number(result.value.toFixed(6)).toLocaleString()}
              {suffix}
            </p>
          )}
          <ul className="mt-4 space-y-1 rounded-lg bg-secondary/40 p-3 font-mono text-xs text-muted-foreground" dir="ltr">
            {result.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </ToolPanel>
      )}

      <ToolPanel title={t('calc.formulaReference')}>
        <ul className="space-y-2 text-sm text-muted-foreground">
          {MODES.map((value) => (
            <li key={value} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
              <span className="font-medium text-foreground">{t(`calc.pctMode_${value}` as never)}:</span>
              <code dir="ltr" className="font-mono text-xs">
                {t(`calc.pctFormula_${value}` as never)}
              </code>
            </li>
          ))}
        </ul>
      </ToolPanel>

      <Notice>{t('calc.percentHint')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
