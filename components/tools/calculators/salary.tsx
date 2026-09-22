'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { calculateSalary } from '@/lib/calculators';
import { Field, Notice, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

const CURRENCIES = ['$', '€', '£', 'ر.س', 'د.إ', 'ج.م'];

/** Gross → net salary with tax rate and fixed deductions. */
export default function SalaryCalculatorTool() {
  const t = useTranslations();
  const [symbol, setSymbol] = React.useState('$');
  const [gross, setGross] = React.useState('5000');
  const [tax, setTax] = React.useState(20);
  const [deductions, setDeductions] = React.useState('200');

  const result = React.useMemo(
    () => calculateSalary(Number(gross), tax, Number(deductions)),
    [gross, tax, deductions],
  );

  const money = (value: number) =>
    `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <PrivacyNotice scope="inputs" />
      <ToolPanel
        title={t('calc.salaryDetails')}
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
                setGross('5000');
                setTax(20);
                setDeductions('200');
              }}
            />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('calc.grossMonthly')}>
            <Input type="number" min={0} value={gross} onChange={(e) => setGross(e.target.value)} dir="ltr" />
          </Field>
          <Slider label={t('calc.taxRate')} min={0} max={60} value={tax} onValueChange={setTax} valueSuffix="%" />
          <Field label={t('calc.deductions')}>
            <Input type="number" min={0} value={deductions} onChange={(e) => setDeductions(e.target.value)} dir="ltr" />
          </Field>
        </div>
        <div className="mt-4">
          <Notice variant="info">{t('calc.salaryFlatNote')}</Notice>
        </div>
      </ToolPanel>

      {result && (
        <StatGrid
          columns={4}
          items={[
            { label: t('calc.netMonthly'), value: money(result.netMonthly), accent: true },
            { label: t('calc.netYearly'), value: money(result.netYearly) },
            { label: t('calc.taxMonthly'), value: money(result.taxMonthly) },
            { label: t('calc.effectiveRate'), value: `${result.effectiveRate.toFixed(1)}%` },
          ]}
        />
      )}
    </div>
  );
}
