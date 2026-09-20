'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { calculateMargin } from '@/lib/calculators';
import { Field, Notice, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

const CURRENCIES = ['$', '€', '£', 'ر.س', 'د.إ', 'ج.م'];

/** Profit margin and markup from cost + selling price. */
export default function MarginCalculatorTool() {
  const t = useTranslations();
  const [symbol, setSymbol] = React.useState('$');
  const [cost, setCost] = React.useState('60');
  const [price, setPrice] = React.useState('100');

  const result = React.useMemo(() => calculateMargin(Number(cost), Number(price)), [cost, price]);

  const money = (value: number) =>
    `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <ToolPanel
        title={t('calc.marginDetails')}
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
                setCost('60');
                setPrice('100');
              }}
            />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('calc.cost')}>
            <Input type="number" min={0} value={cost} onChange={(e) => setCost(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('calc.sellingPrice')}>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} dir="ltr" />
          </Field>
        </div>
        <div className="mt-4">
          <Notice variant="info">{t('calc.marginExplainer')}</Notice>
        </div>
      </ToolPanel>

      {result && (
        <StatGrid
          columns={4}
          items={[
            { label: t('calc.margin'), value: `${result.marginPercent.toFixed(2)}%`, accent: true },
            { label: t('calc.markup'), value: `${result.markupPercent.toFixed(2)}%` },
            { label: t('calc.profit'), value: money(result.profit) },
            { label: t('calc.revenue'), value: money(result.revenue) },
          ]}
        />
      )}
    </div>
  );
}
