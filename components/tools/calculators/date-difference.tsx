'use client';

import * as React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dateDifference } from '@/lib/calculators';
import { CheckboxRow, CopyButton, Field, InlineError, PrivacyNotice, ResetButton, StatGrid, ToolPanel } from '../kit';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parse(dateStr: string, timeStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr && /^\d{2}:\d{2}$/.test(timeStr) ? timeStr.split(':').map(Number) : [0, 0];
  const date = new Date(y, m - 1, d, hh, mm);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export default function DateDifferenceTool() {
  const t = useTranslations();
  const locale = useLocale();
  const [start, setStart] = React.useState(todayIso());
  const [end, setEnd] = React.useState(todayIso());
  const [withTime, setWithTime] = React.useState(false);
  const [startTime, setStartTime] = React.useState('00:00');
  const [endTime, setEndTime] = React.useState('00:00');
  const [businessOnly, setBusinessOnly] = React.useState(false);
  const [excluded, setExcluded] = React.useState('');

  const startDate = parse(start, withTime ? startTime : '');
  const endDate = parse(end, withTime ? endTime : '');
  const invalid = (start && !startDate) || (end && !endDate);

  const excludedDates = React.useMemo(
    () => excluded.split(/[\s,]+/).filter((v) => /^\d{4}-\d{2}-\d{2}$/.test(v)),
    [excluded],
  );

  const result = React.useMemo(
    () => (startDate && endDate ? dateDifference(startDate, endDate, excludedDates) : null),
    [startDate, endDate, excludedDates],
  );

  const weekday = (date: Date) => new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date);

  const summary = result
    ? `${result.years}y ${result.months}m ${result.days}d · ${result.totalDays} ${t('calc.days')}`
    : '';

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('calc.enterDates')}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStart(end);
                setEnd(start);
              }}
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              {t('calc.swapDates')}
            </Button>
            <ResetButton
              onClick={() => {
                setStart(todayIso());
                setEnd(todayIso());
                setExcluded('');
              }}
            />
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('calc.startDate')}>
            <div className="flex gap-2">
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              {withTime && <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
              <Button variant="outline" onClick={() => setStart(todayIso())}>
                {t('calc.today')}
              </Button>
            </div>
          </Field>
          <Field label={t('calc.endDate')}>
            <div className="flex gap-2">
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              {withTime && <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
              <Button variant="outline" onClick={() => setEnd(todayIso())}>
                {t('calc.today')}
              </Button>
            </div>
          </Field>
        </div>

        <div className="mt-4 space-y-1">
          <CheckboxRow checked={withTime} onChange={setWithTime} label={t('calc.includeTime')} />
          <CheckboxRow checked={businessOnly} onChange={setBusinessOnly} label={t('calc.businessDaysOnly')} />
        </div>

        {businessOnly && (
          <div className="mt-4">
            <Field label={t('calc.excludeDates')}>
              <Input
                value={excluded}
                onChange={(e) => setExcluded(e.target.value)}
                placeholder="2026-01-01, 2026-12-25"
                dir="ltr"
              />
            </Field>
            <p className="mt-1 text-xs text-muted-foreground">{t('calc.excludeHint')}</p>
          </div>
        )}
      </ToolPanel>

      {invalid && <InlineError message={t('errors.invalidDate')} />}

      {result && startDate && endDate && (
        <>
          <ToolPanel title={t('calc.difference')} actions={<CopyButton value={summary} />}>
            <p className="text-3xl font-bold text-foreground">
              {t('calc.ymd', { years: result.years, months: result.months, days: result.days })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t('calc.weekdays', { start: weekday(startDate), end: weekday(endDate) })} ·{' '}
              {result.future ? t('calc.inFuture') : t('calc.inPast')}
            </p>
          </ToolPanel>

          <StatGrid
            items={[
              ...(businessOnly
                ? [{ label: t('calc.businessDays'), value: result.businessDays.toLocaleString(), accent: true }]
                : []),
              { label: t('calc.totalMonths'), value: result.totalMonths.toLocaleString() },
              { label: t('calc.totalWeeks'), value: result.totalWeeks.toLocaleString() },
              { label: t('calc.totalDays'), value: result.totalDays.toLocaleString(), accent: !businessOnly },
              { label: t('calc.totalHours'), value: result.totalHours.toLocaleString() },
              { label: t('calc.totalMinutes'), value: result.totalMinutes.toLocaleString() },
              { label: t('calc.totalSeconds'), value: result.totalSeconds.toLocaleString() },
            ]}
          />
        </>
      )}

      <PrivacyNotice />
    </div>
  );
}
