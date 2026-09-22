'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { calculateMortgage } from '@/lib/calculators';
import { Field, Notice, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

const CURRENCIES = ['$', '€', '£', 'ر.س', 'د.إ', 'ج.م'];

/** Mortgage estimate with tax + insurance slices. */
export default function MortgageCalculatorTool() {
  const t = useTranslations();
  const [symbol, setSymbol] = React.useState('$');
  const [price, setPrice] = React.useState('350000');
  const [down, setDown] = React.useState('70000');
  const [rate, setRate] = React.useState(6.5);
  const [years, setYears] = React.useState(30);
  const [taxRate, setTaxRate] = React.useState(1.1);
  const [insurance, setInsurance] = React.useState('1500');

  const result = React.useMemo(
    () => calculateMortgage(Number(price), Number(down), rate, years, taxRate, Number(insurance)),
    [price, down, rate, years, taxRate, insurance],
  );

  const money = (value: number) =>
    `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <PrivacyNotice scope="inputs" />
      <ToolPanel
        title={t('calc.mortgageDetails')}
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
                setPrice('350000');
                setDown('70000');
                setRate(6.5);
                setYears(30);
                setTaxRate(1.1);
                setInsurance('1500');
              }}
            />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('calc.homePrice')}>
            <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('calc.downPayment')}>
            <Input type="number" min={0} value={down} onChange={(e) => setDown(e.target.value)} dir="ltr" />
          </Field>
          <Field label={t('calc.annualInsurance')}>
            <Input type="number" min={0} value={insurance} onChange={(e) => setInsurance(e.target.value)} dir="ltr" />
          </Field>
          <Slider label={t('calc.annualRate')} min={0} max={20} value={rate} onValueChange={setRate} valueSuffix="%" />
          <Slider label={t('calc.loanTerm')} min={1} max={30} value={years} onValueChange={setYears} />
          <Slider label={t('calc.propertyTax')} min={0} max={5} value={taxRate} onValueChange={setTaxRate} valueSuffix="%" />
        </div>
        <div className="mt-4">
          <Notice variant="info">{t('calc.mortgageEstimate')}</Notice>
        </div>
      </ToolPanel>

      {result && (
        <StatGrid
          columns={4}
          items={[
            { label: t('calc.totalMonthly'), value: money(result.totalMonthly), accent: true },
            { label: t('calc.principalInterest'), value: money(result.principalInterest) },
            { label: t('calc.taxInsurance'), value: money(result.taxMonthly + result.insuranceMonthly) },
            { label: t('calc.loanAmountLabel'), value: money(result.loanAmount) },
          ]}
        />
      )}
    </div>
  );
}
