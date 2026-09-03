'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { calculateTip } from '@/lib/calculators';
import { CheckboxRow, CopyButton, Field, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

const PRESETS = [10, 15, 18, 20, 25];
const CURRENCIES = ['$', '€', '£', 'ر.س', 'د.إ', 'ج.م'];

export default function TipCalculatorTool() {
  const t = useTranslations();
  const [symbol, setSymbol] = React.useState('$');
  const [bill, setBill] = React.useState('50');
  const [tipPercent, setTipPercent] = React.useState(18);
  const [people, setPeople] = React.useState(2);
  const [roundUp, setRoundUp] = React.useState(false);

  const amount = Number(bill);
  const result = React.useMemo(
    () => (amount > 0 ? calculateTip(amount, tipPercent, people, roundUp) : null),
    [amount, tipPercent, people, roundUp],
  );

  const money = (value: number) =>
    `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('calc.billDetails')}
        actions={
          <>
            <Select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              options={CURRENCIES.map((c) => ({ value: c, label: c }))}
              className="w-20"
            />
            <ResetButton
              onClick={() => {
                setBill('50');
                setTipPercent(18);
                setPeople(2);
                setRoundUp(false);
              }}
            />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('calc.billAmount')}>
            <Input type="number" min={0} step="0.01" value={bill} onChange={(e) => setBill(e.target.value)} dir="ltr" />
          </Field>

          <Field label={t('calc.numberOfPeople')}>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setPeople((n) => Math.max(1, n - 1))} aria-label="-">
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min={1}
                max={100}
                value={people}
                onChange={(e) => setPeople(Math.max(1, Number(e.target.value) || 1))}
                dir="ltr"
                className="text-center"
              />
              <Button variant="outline" size="icon" onClick={() => setPeople((n) => Math.min(100, n + 1))} aria-label="+">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Field>
        </div>

        <div className="mt-4 space-y-2">
          <span className="text-sm font-medium text-foreground">
            {t('calc.tipPercent')}: <span className="tabular-nums">{tipPercent}%</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset}
                variant={tipPercent === preset ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTipPercent(preset)}
              >
                {preset}%
              </Button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={50}
            step={1}
            value={tipPercent}
            onChange={(e) => setTipPercent(Number(e.target.value))}
            aria-label={t('calc.tipPercent')}
            className="w-full accent-[hsl(var(--primary))]"
          />
        </div>

        <div className="mt-3">
          <CheckboxRow checked={roundUp} onChange={setRoundUp} label={t('calc.roundUp')} hint={t('calc.roundUpHint')} />
        </div>
      </ToolPanel>

      {result && (
        <>
          <StatGrid
            items={[
              { label: t('calc.tipAmount'), value: money(result.tipAmount), accent: true },
              { label: t('calc.totalBill'), value: money(result.total) },
              { label: t('calc.perPerson'), value: money(result.perPerson), accent: true },
              { label: t('calc.tipPerPerson'), value: money(result.tipPerPerson) },
            ]}
          />
          <ToolPanel title={t('calc.formulaBreakdown')} actions={<CopyButton value={result.steps.join('\n')} />}>
            <ul className="space-y-1 font-mono text-xs text-muted-foreground" dir="ltr">
              {result.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ul>
          </ToolPanel>
        </>
      )}

      <PrivacyNotice />
    </div>
  );
}
