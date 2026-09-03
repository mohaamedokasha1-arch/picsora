'use client';

import * as React from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { discountPercentFromPrices, originalFromDiscounted, stackedDiscount } from '@/lib/calculators';
import { CheckboxRow, CopyButton, Field, PrivacyNotice, ResetButton, StatGrid, ToggleGroup, ToolPanel } from '../kit';

type Mode = 'percentOff' | 'findPercent' | 'findOriginal';

const CURRENCIES = ['$', '€', '£', 'ر.س', 'د.إ', 'ج.م', '¥'];

export default function DiscountCalculatorTool() {
  const t = useTranslations();
  const [mode, setMode] = React.useState<Mode>('percentOff');
  const [symbol, setSymbol] = React.useState('$');
  const [original, setOriginal] = React.useState('100');
  const [discounted, setDiscounted] = React.useState('80');
  const [percents, setPercents] = React.useState<string[]>(['20']);
  const [taxOn, setTaxOn] = React.useState(false);
  const [tax, setTax] = React.useState('10');

  const money = (value: number) =>
    `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const numericPercents = percents.map((p) => Number(p)).filter((p) => Number.isFinite(p));
  const taxPercent = taxOn ? Number(tax) || 0 : 0;

  const result = React.useMemo(() => {
    const base = Number(original);
    if (mode === 'percentOff') {
      if (!(base > 0)) return null;
      return stackedDiscount(base, numericPercents, taxPercent);
    }
    if (mode === 'findPercent') {
      const disc = Number(discounted);
      const percent = discountPercentFromPrices(base, disc);
      if (percent === null) return null;
      return stackedDiscount(base, [percent], taxPercent);
    }
    const disc = Number(discounted);
    const orig = originalFromDiscounted(disc, numericPercents[0] ?? 0);
    if (orig === null) return null;
    return stackedDiscount(orig, [numericPercents[0] ?? 0], taxPercent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, original, discounted, percents.join(','), taxPercent]);

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('calc.chooseMode')}
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
                setOriginal('100');
                setDiscounted('80');
                setPercents(['20']);
              }}
            />
          </>
        }
      >
        <ToggleGroup
          value={mode}
          onChange={setMode}
          options={[
            { value: 'percentOff', label: t('calc.discMode_percentOff') },
            { value: 'findPercent', label: t('calc.discMode_findPercent') },
            { value: 'findOriginal', label: t('calc.discMode_findOriginal') },
          ]}
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {mode !== 'findOriginal' && (
            <Field label={t('calc.originalPrice')}>
              <Input type="number" min={0} value={original} onChange={(e) => setOriginal(e.target.value)} dir="ltr" />
            </Field>
          )}
          {mode !== 'percentOff' && (
            <Field label={t('calc.discountedPrice')}>
              <Input type="number" min={0} value={discounted} onChange={(e) => setDiscounted(e.target.value)} dir="ltr" />
            </Field>
          )}
        </div>

        {mode !== 'findPercent' && (
          <div className="mt-4 space-y-2">
            <span className="text-sm font-medium text-foreground">{t('calc.discounts')}</span>
            {percents.map((percent, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  type="number"
                  value={percent}
                  onChange={(e) =>
                    setPercents((prev) => prev.map((value, i) => (i === index ? e.target.value : value)))
                  }
                  dir="ltr"
                  className="max-w-[140px]"
                />
                <span className="text-sm text-muted-foreground">%</span>
                {percents.length > 1 && mode === 'percentOff' && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setPercents((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={t('common.close')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {mode === 'percentOff' && percents.length < 5 && (
              <Button variant="outline" size="sm" onClick={() => setPercents((prev) => [...prev, '10'])}>
                <Plus className="h-3.5 w-3.5" />
                {t('calc.addDiscount')}
              </Button>
            )}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <CheckboxRow checked={taxOn} onChange={setTaxOn} label={t('calc.addTax')} />
          {taxOn && (
            <div className="max-w-[160px]">
              <Field label={t('calc.taxPercent')}>
                <Input type="number" min={0} value={tax} onChange={(e) => setTax(e.target.value)} dir="ltr" />
              </Field>
            </div>
          )}
        </div>
      </ToolPanel>

      {result && (
        <>
          <StatGrid
            items={[
              { label: t('calc.originalPrice'), value: money(result.original) },
              { label: t('calc.youSave'), value: money(result.discountAmount), accent: true },
              { label: t('calc.priceAfterDiscount'), value: money(result.afterDiscount) },
              ...(taxOn ? [{ label: t('calc.taxAmount'), value: money(result.taxAmount) }] : []),
              { label: t('calc.finalTotal'), value: money(result.finalTotal), accent: true },
              { label: t('calc.effectiveDiscount'), value: `${result.effectivePercent.toFixed(2)}%` },
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
