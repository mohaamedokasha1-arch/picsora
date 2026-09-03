'use client';

import * as React from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { calculateAge, isValidDate } from '@/lib/calculators';
import { CopyButton, Field, InlineError, Notice, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseIso(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Reject impossible dates like 2024-02-30 (which JS would roll over).
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export default function AgeCalculatorTool() {
  const t = useTranslations();
  const locale = useLocale();
  const today = React.useMemo(() => toIso(new Date()), []);
  const [birth, setBirth] = React.useState('');
  const [asOf, setAsOf] = React.useState(today);

  const birthDate = parseIso(birth);
  const asOfDate = parseIso(asOf);
  const invalid = (birth && !birthDate) || (asOf && !asOfDate);
  const future = birthDate && asOfDate && birthDate > asOfDate;

  const result = React.useMemo(
    () => (isValidDate(birthDate) && isValidDate(asOfDate) && !future ? calculateAge(birthDate, asOfDate) : null),
    [birthDate, asOfDate, future],
  );

  const weekdayName = (date: Date) => new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);
  const dateName = (date: Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(date);

  const summary = result
    ? [
        `${t('calc.exactAge')}: ${result.years}y ${result.months}m ${result.days}d`,
        `${t('calc.totalDays')}: ${result.totalDays}`,
        `${t('calc.nextBirthday')}: ${result.daysToNextBirthday} ${t('calc.days')}`,
      ].join('\n')
    : '';

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('calc.enterDates')}
        actions={
          <ResetButton
            onClick={() => {
              setBirth('');
              setAsOf(today);
            }}
          />
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('calc.dateOfBirth')}>
            <Input type="date" value={birth} max={asOf} onChange={(e) => setBirth(e.target.value)} />
          </Field>
          <Field label={t('calc.asOfDate')}>
            <div className="flex gap-2">
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              <Button variant="outline" onClick={() => setAsOf(today)}>
                {t('calc.useToday')}
              </Button>
            </div>
          </Field>
        </div>
      </ToolPanel>

      {invalid && <InlineError message={t('errors.invalidDate')} />}
      {future && <InlineError message={t('errors.birthAfterAsOf')} />}

      {result && birthDate && (
        <>
          <ToolPanel title={t('calc.exactAge')} actions={<CopyButton value={summary} />}>
            <p className="text-3xl font-bold text-foreground">
              {t('calc.ymd', { years: result.years, months: result.months, days: result.days })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('calc.bornOn', { weekday: weekdayName(birthDate), date: dateName(birthDate) })}
            </p>
          </ToolPanel>

          <StatGrid
            items={[
              { label: t('calc.totalMonths'), value: result.totalMonths.toLocaleString() },
              { label: t('calc.totalWeeks'), value: result.totalWeeks.toLocaleString() },
              { label: t('calc.totalDays'), value: result.totalDays.toLocaleString(), accent: true },
              { label: t('calc.totalHours'), value: result.totalHours.toLocaleString() },
              { label: t('calc.totalMinutes'), value: result.totalMinutes.toLocaleString() },
              { label: t('calc.totalSeconds'), value: result.totalSeconds.toLocaleString() },
              {
                label: t('calc.nextBirthday'),
                value: t('calc.inDays', { days: result.daysToNextBirthday }),
                hint: dateName(result.nextBirthday),
                accent: true,
              },
              { label: t('calc.zodiac'), value: t(`calc.zodiac_${result.zodiac}` as never) },
              { label: t('calc.chineseZodiac'), value: t(`calc.chinese_${result.chineseZodiac}` as never) },
            ]}
          />
        </>
      )}

      {!birth && <Notice>{t('calc.ageHint')}</Notice>}
      <PrivacyNotice />
    </div>
  );
}
