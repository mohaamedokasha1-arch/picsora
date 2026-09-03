'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { calculateBmi, inchesToCm, lbsToKg, type BmiCategory } from '@/lib/calculators';
import { CopyButton, Field, Notice, PrivacyNotice, ResetButton, StatGrid, ToggleGroup, ToolPanel } from '../kit';

const COLORS: Record<BmiCategory, string> = {
  underweight: 'text-sky-600 dark:text-sky-400',
  normal: 'text-emerald-600 dark:text-emerald-400',
  overweight: 'text-amber-600 dark:text-amber-400',
  obese1: 'text-orange-600 dark:text-orange-400',
  obese2: 'text-red-600 dark:text-red-400',
  obese3: 'text-red-700 dark:text-red-500',
};

/** Gauge segments: [label, upper bound, tailwind bg]. */
const SEGMENTS: [BmiCategory, number, string][] = [
  ['underweight', 18.5, 'bg-sky-500'],
  ['normal', 25, 'bg-emerald-500'],
  ['overweight', 30, 'bg-amber-500'],
  ['obese1', 35, 'bg-orange-500'],
  ['obese2', 40, 'bg-red-500'],
  ['obese3', 50, 'bg-red-700'],
];

export default function BmiCalculatorTool() {
  const t = useTranslations();
  const [metric, setMetric] = React.useState(true);
  const [cm, setCm] = React.useState('');
  const [kg, setKg] = React.useState('');
  const [feet, setFeet] = React.useState('');
  const [inches, setInches] = React.useState('');
  const [lbs, setLbs] = React.useState('');

  const heightCm = metric ? Number(cm) : inchesToCm(Number(feet || 0) * 12 + Number(inches || 0));
  const weightKg = metric ? Number(kg) : lbsToKg(Number(lbs));

  const result = React.useMemo(
    () => (heightCm > 0 && weightKg > 0 ? calculateBmi(weightKg, heightCm) : null),
    [heightCm, weightKg],
  );

  const reset = () => {
    setCm('');
    setKg('');
    setFeet('');
    setInches('');
    setLbs('');
  };

  const position = result ? Math.min(100, Math.max(0, (result.bmi / 50) * 100)) : 0;
  const toDisplayWeight = (value: number) =>
    metric ? `${value.toFixed(1)} kg` : `${(value / 0.45359237).toFixed(1)} lb`;

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('calc.measurements')}
        actions={
          <>
            <ToggleGroup
              value={metric ? 'metric' : 'imperial'}
              onChange={(value) => setMetric(value === 'metric')}
              options={[
                { value: 'metric', label: t('calc.metric') },
                { value: 'imperial', label: t('calc.imperial') },
              ]}
            />
            <ResetButton onClick={reset} />
          </>
        }
      >
        {metric ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('calc.heightCm')}>
              <Input type="number" min={30} max={280} value={cm} onChange={(e) => setCm(e.target.value)} placeholder="175" />
            </Field>
            <Field label={t('calc.weightKg')}>
              <Input type="number" min={1} max={700} value={kg} onChange={(e) => setKg(e.target.value)} placeholder="70" />
            </Field>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('calc.heightFt')}>
              <Input type="number" min={0} max={9} value={feet} onChange={(e) => setFeet(e.target.value)} placeholder="5" />
            </Field>
            <Field label={t('calc.heightIn')}>
              <Input type="number" min={0} max={11} value={inches} onChange={(e) => setInches(e.target.value)} placeholder="9" />
            </Field>
            <Field label={t('calc.weightLb')}>
              <Input type="number" min={1} max={1500} value={lbs} onChange={(e) => setLbs(e.target.value)} placeholder="155" />
            </Field>
          </div>
        )}
      </ToolPanel>

      {result && (
        <>
          <ToolPanel
            title={t('calc.yourBmi')}
            actions={<CopyButton value={`BMI ${result.bmi.toFixed(2)} — ${t(`calc.bmi_${result.category}` as never)}`} />}
          >
            <div className="flex flex-wrap items-baseline gap-3">
              <span className={cn('text-4xl font-bold tabular-nums', COLORS[result.category])}>
                {result.bmi.toFixed(2)}
              </span>
              <span className={cn('text-lg font-semibold', COLORS[result.category])}>
                {t(`calc.bmi_${result.category}` as never)}
              </span>
            </div>

            {/* Pure-CSS gauge — no chart library. */}
            <div className="mt-5">
              <div className="relative h-3 w-full overflow-hidden rounded-full">
                <div className="flex h-full w-full">
                  {SEGMENTS.map(([key, bound, color], i) => {
                    const lower = i === 0 ? 0 : SEGMENTS[i - 1][1];
                    return (
                      <span
                        key={key}
                        className={color}
                        style={{ width: `${((bound - lower) / 50) * 100}%` }}
                        title={t(`calc.bmi_${key}` as never)}
                      />
                    );
                  })}
                </div>
              </div>
              <div
                className="relative -mt-1 h-4"
                aria-hidden="true"
              >
                <span
                  className="absolute top-0 h-4 w-1 -translate-x-1/2 rounded-full bg-foreground shadow"
                  style={{ insetInlineStart: `${position}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>0</span>
                <span>18.5</span>
                <span>25</span>
                <span>30</span>
                <span>40</span>
                <span>50</span>
              </div>
            </div>

            <p className="mt-4 text-sm text-muted-foreground">
              {t('calc.healthyRange', {
                min: toDisplayWeight(result.healthyMinKg),
                max: toDisplayWeight(result.healthyMaxKg),
              })}
            </p>
          </ToolPanel>

          <StatGrid
            columns={3}
            items={[
              { label: t('calc.bmiPrime'), value: result.bmiPrime.toFixed(2), hint: t('calc.bmiPrimeHint') },
              { label: t('calc.ponderalIndex'), value: result.ponderalIndex.toFixed(2) },
              { label: t('calc.category'), value: t(`calc.bmi_${result.category}` as never) },
            ]}
          />
        </>
      )}

      <Notice variant="warning">{t('calc.bmiDisclaimer')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
