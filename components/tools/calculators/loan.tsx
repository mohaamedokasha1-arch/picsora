'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { calculateLoan } from '@/lib/calculators';
import { Field, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

const CURRENCIES = ['$', '€', '£', 'ر.س', 'د.إ', 'ج.م'];

/** Loan payments, total interest and payoff schedule summary. */
export default function LoanCalculatorTool() {
  const t = useTranslations();
  const [symbol, setSymbol] = React.useState('$');
  const [principal, setPrincipal] = React.useState('20000');
  const [rate, setRate] = React.useState(8);
  const [years, setYears] = React.useState(5);

  const result = React.useMemo(
    () => calculateLoan(Number(principal), rate, years),
    [principal, rate, years],
  );

  const money = (value: number) =>
    `${symbol}${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <ToolPanel
        title={t('calc.loanDetails')}
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
                setPrincipal('20000');
                setRate(8);
                setYears(5);
              }}
            />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Field label={t('calc.loanAmount')}>
            <Input type="number" min={0} value={principal} onChange={(e) => setPrincipal(e.target.value)} dir="ltr" />
          </Field>
          <Slider label={t('calc.annualRate')} min={0} max={30} value={rate} onValueChange={setRate} valueSuffix="%" />
          <Slider label={t('calc.loanTerm')} min={1} max={30} value={years} onValueChange={setYears} />
        </div>
      </ToolPanel>

      {result && (
        <StatGrid
          columns={4}
          items={[
            { label: t('calc.monthlyPayment'), value: money(result.monthlyPayment), accent: true },
            { label: t('calc.totalInterest'), value: money(result.totalInterest) },
            { label: t('calc.totalPayment'), value: money(result.totalPayment) },
            { label: t('calc.paymentsCount'), value: String(result.payments) },
          ]}
        />
      )}
    </div>
  );
}
