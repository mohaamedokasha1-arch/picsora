'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { compoundInterest, simpleInterest, type CompoundFrequency } from '@/lib/calculators';
import { CopyButton, Field, Notice, PrivacyNotice, ResetButton, StatGrid, ToggleGroup, ToolPanel } from '../kit';

const FREQUENCIES: { value: CompoundFrequency; key: string }[] = [
  { value: 1, key: 'annually' },
  { value: 2, key: 'semiAnnually' },
  { value: 4, key: 'quarterly' },
  { value: 12, key: 'monthly' },
  { value: 365, key: 'daily' },
];

const money = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });

export default function InterestCalculatorTool() {
  const t = useTranslations();
  const [mode, setMode] = React.useState<'simple' | 'compound'>('compound');
  const [principal, setPrincipal] = React.useState('10000');
  const [rate, setRate] = React.useState('5');
  const [years, setYears] = React.useState('5');
  const [unit, setUnit] = React.useState<'years' | 'months'>('years');
  const [frequency, setFrequency] = React.useState<CompoundFrequency>(12);
  const [expanded, setExpanded] = React.useState(false);

  const p = Number(principal);
  const r = Number(rate);
  const timeYears = unit === 'years' ? Number(years) : Number(years) / 12;
  const valid = p > 0 && Number.isFinite(r) && timeYears > 0;

  const simple = React.useMemo(() => (valid && mode === 'simple' ? simpleInterest(p, r, timeYears) : null), [valid, mode, p, r, timeYears]);
  const compound = React.useMemo(
    () => (valid && mode === 'compound' ? compoundInterest(p, r, timeYears, frequency) : null),
    [valid, mode, p, r, timeYears, frequency],
  );

  const active = simple ?? compound;
  const rows = compound?.yearly ?? [];
  const visibleRows = expanded ? rows : rows.slice(0, 10);

  const reset = () => {
    setPrincipal('10000');
    setRate('5');
    setYears('5');
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('calc.interestMode')}
        actions={
          <>
            <ToggleGroup
              value={mode}
              onChange={setMode}
              options={[
                { value: 'simple', label: t('calc.simpleInterest') },
                { value: 'compound', label: t('calc.compoundInterest') },
              ]}
            />
            <ResetButton onClick={reset} />
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label={t('calc.principal')}>
            <Input type="number" min={0} value={principal} onChange={(e) => setPrincipal(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('calc.annualRate')}>
            <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('calc.time')}>
            <div className="flex gap-2">
              <Input type="number" min={0} step="0.1" value={years} onChange={(e) => setYears(e.target.value)} dir="ltr" />
              <Select
                value={unit}
                onChange={(e) => setUnit(e.target.value as 'years' | 'months')}
                options={[
                  { value: 'years', label: t('calc.years') },
                  { value: 'months', label: t('calc.months') },
                ]}
              />
            </div>
          </Field>
          {mode === 'compound' && (
            <Field label={t('calc.compoundFrequency')}>
              <Select
                value={String(frequency)}
                onChange={(e) => setFrequency(Number(e.target.value) as CompoundFrequency)}
                options={FREQUENCIES.map((f) => ({ value: String(f.value), label: t(`calc.freq_${f.key}` as never) }))}
              />
            </Field>
          )}
        </div>
      </ToolPanel>

      {active && (
        <>
          <StatGrid
            columns={mode === 'compound' ? 3 : 2}
            items={[
              { label: t('calc.interestEarned'), value: money(active.interest), accent: true },
              { label: t('calc.totalAmount'), value: money(active.total) },
              ...(compound
                ? [{ label: t('calc.effectiveAnnualRate'), value: `${compound.effectiveAnnualRate.toFixed(3)}%` }]
                : []),
            ]}
          />

          <ToolPanel
            title={t('calc.formulaBreakdown')}
            actions={<CopyButton value={active.steps.join('\n')} />}
          >
            <ul className="space-y-1 font-mono text-xs text-muted-foreground" dir="ltr">
              {active.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </ToolPanel>
        </>
      )}

      {compound && rows.length > 0 && (
        <ToolPanel
          title={t('calc.yearlyBreakdown')}
          actions={
            rows.length > 10 ? (
              <button type="button" onClick={() => setExpanded((v) => !v)} className="text-sm font-medium text-primary">
                {expanded ? t('calc.showLess') : t('calc.showAll', { count: rows.length })}
              </button>
            ) : undefined
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                  <th className="p-2 text-start font-medium">{t('calc.year')}</th>
                  <th className="p-2 text-end font-medium">{t('calc.interestThisYear')}</th>
                  <th className="p-2 text-end font-medium">{t('calc.balance')}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.year} className="border-b border-border/60 last:border-0">
                    <td className="p-2 tabular-nums text-foreground">{row.year}</td>
                    <td className="p-2 text-end tabular-nums text-muted-foreground">{money(row.interest)}</td>
                    <td className="p-2 text-end tabular-nums font-medium text-foreground">{money(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ToolPanel>
      )}

      <Notice variant="warning">{t('calc.financialDisclaimer')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
