'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { calculateAverage, parseNumberList } from '@/lib/calculators';
import { PrivacyNotice, ResetButton, StatGrid, TextArea, ToolPanel } from '../kit';

/** Mean, median, mode and range for any number list. */
export default function AverageCalculatorTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('12, 18, 25, 25, 31, 40');

  const numbers = React.useMemo(() => parseNumberList(input), [input]);
  const result = React.useMemo(() => calculateAverage(numbers), [numbers]);

  const num = (value: number) =>
    value.toLocaleString(undefined, { maximumFractionDigits: 4 });

  return (
    <div className="space-y-5">
      <PrivacyNotice scope="inputs" />
      <ToolPanel
        title={t('calc.averageInput')}
        actions={<ResetButton onClick={() => setInput('')} label={t('textTools.clear')} />}
      >
        <TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('calc.averagePlaceholder')}
          aria-label={t('calc.averageInput')}
          dir="ltr"
          mono
          className="min-h-[110px] resize-y"
        />
        <p className="mt-2 text-xs text-muted-foreground">{t('calc.averageHint')}</p>
      </ToolPanel>

      {result && (
        <StatGrid
          columns={4}
          items={[
            { label: t('calc.mean'), value: num(result.mean), accent: true },
            { label: t('calc.median'), value: num(result.median) },
            { label: t('calc.mode'), value: result.mode.length ? result.mode.map(num).join(', ') : '—' },
            { label: t('calc.count'), value: String(result.count) },
            { label: t('calc.sum'), value: num(result.sum) },
            { label: t('calc.min'), value: num(result.min) },
            { label: t('calc.max'), value: num(result.max) },
            { label: t('calc.range'), value: num(result.range) },
          ]}
        />
      )}
    </div>
  );
}
