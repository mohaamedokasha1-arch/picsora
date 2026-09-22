'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { calculateVat } from '@/lib/calculators';
import { CopyButton, Field, PrivacyNotice, ResetButton, StatGrid, ToggleGroup, ToolPanel } from '../kit';

const CURRENCIES = ['$', '€', '£', 'ر.س', 'د.إ', 'ج.م'];
const RATES = [5, 10, 14, 15, 16, 19, 20, 21, 22, 25];

/** Add or remove VAT at any rate. */
export default function VatCalculatorTool() {
  const t = useTranslations();
  const [symbol, setSymbol] = React.useState('$');
  const [amount, setAmount] = React.useState('100');
  const [rate, setRate] = React.useState(15);
  const [mode, setMode] = React.useState<'add' | 'remove'>('add');

  const result = React.useMemo(() => calculateVat(Number(amount), rate, mode), [amount, rate, mode]);

  const money = (value: number) =>
    `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const asText = result
    ? `Net: ${money(result.net)}\nVAT (${result.rate}%): ${money(result.vatAmount)}\nGross: ${money(result.gross)}`
    : '';

  return (
    <div className="space-y-5">
      <PrivacyNotice scope="inputs" />
      <ToolPanel
        title={t('calc.vatDetails')}
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
                setAmount('100');
                setRate(15);
                setMode('add');
              }}
            />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3 md:items-end">
          <Field label={t('calc.vatAmount')}>
            <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('calc.vatRate')}>
            <Select
              value={String(rate)}
              onChange={(e) => setRate(Number(e.target.value))}
              options={RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
            />
          </Field>
          <ToggleGroup<'add' | 'remove'>
            label={t('calc.vatMode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'add', label: t('calc.vatAdd') },
              { value: 'remove', label: t('calc.vatRemove') },
            ]}
          />
        </div>
      </ToolPanel>

      {result && (
        <StatGrid
          columns={3}
          items={[
            { label: t('calc.vatNet'), value: money(result.net) },
            { label: t('calc.vatTax', { rate: result.rate }), value: money(result.vatAmount), accent: true },
            { label: t('calc.vatGross'), value: money(result.gross) },
          ]}
        />
      )}
      {result && (
        <ToolPanel title={t('pdfTools.results')} actions={<CopyButton value={asText} />}>
          <p className="whitespace-pre-line font-mono text-sm leading-relaxed text-foreground" dir="ltr">
            {asText}
          </p>
        </ToolPanel>
      )}
    </div>
  );
}
