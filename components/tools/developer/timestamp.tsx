'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton, InlineError, PrivacyNotice, ResetButton, StatGrid, ToolPanel, ToggleGroup } from '../kit';
import {
  describeDate,
  detectUnit,
  localInputToDate,
  offsetLabel,
  toLocalInputValue,
  timestampToDate,
  type TimestampUnit,
} from '@/lib/developer-tools/timestamp';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export default function TimestampConverterTool() {
  const t = useTranslations();
  const [timestamp, setTimestamp] = React.useState(() => String(Math.floor(Date.now() / 1000)));
  const [unit, setUnit] = React.useState<TimestampUnit>('seconds');
  const [dateInput, setDateInput] = React.useState(() => toLocalInputValue(new Date()));

  const date = React.useMemo(() => timestampToDate(timestamp, unit), [timestamp, unit]);
  const description = React.useMemo(() => (date ? describeDate(date) : null), [date]);
  const reverseDate = React.useMemo(() => localInputToDate(dateInput), [dateInput]);

  const relativeText = (() => {
    if (!description) return '';
    const { key, amount, past } = description.relative;
    const unitKey = t(`dev.rel_${key}` as never);
    void unitKey;
    return past ? `~${amount} ${unitKey} ${t('dev.ago')}` : `~${amount} ${unitKey} ${t('dev.fromNow')}`;
  })();

  const useNow = () => {
    const now = new Date();
    setUnit('seconds');
    setTimestamp(String(Math.floor(now.getTime() / 1000)));
    setDateInput(toLocalInputValue(now));
  };

  const onTimestampChange = (value: string) => {
    setTimestamp(value);
    // Keep the unit honest while typing: a 13-digit number is milliseconds.
    if (/^-?\d{12,}$/.test(value.trim())) setUnit('milliseconds');
    else if (/^-?\d{1,11}$/.test(value.trim())) setUnit('seconds');
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('dev.timestampToDate')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={useNow}>
              {t('dev.now')}
            </Button>
            <ResetButton onClick={() => setTimestamp('')} label={t('textTools.clear')} />
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t('dev.unixTimestamp')}</span>
            <Input
              value={timestamp}
              onChange={(e) => onTimestampChange(e.target.value)}
              placeholder="1735689600"
              inputMode="numeric"
              dir="ltr"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t('dev.unit')}</span>
            <ToggleGroup
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'seconds' as TimestampUnit, label: t('dev.seconds') },
                { value: 'milliseconds' as TimestampUnit, label: t('dev.milliseconds') },
              ]}
            />
          </div>
        </div>
        {timestamp && !date && <InlineError message={t('dev.invalidTimestamp')} />}
      </ToolPanel>

      {description && (
        <>
          <StatGrid
            columns={3}
            items={[
              { label: t('dev.unixSeconds'), value: description.unixSeconds.toLocaleString(), accent: true },
              { label: t('dev.unixMilliseconds'), value: description.unixMilliseconds.toLocaleString() },
              { label: t('dev.utcOffset'), value: offsetLabel(description.utcOffsetMinutes) },
            ]}
          />
          <ToolPanel title={t('dev.readableDate')}>
            <div className="divide-y divide-border">
              {[
                { label: t('dev.iso8601'), value: description.iso },
                { label: t('dev.localTime'), value: description.local },
                { label: t('dev.utcTime'), value: description.utc },
                { label: t('dev.dateOnly'), value: description.dateOnly },
                { label: t('dev.timeOnly'), value: description.timeOnly },
                {
                  label: t('dev.dayOfWeek'),
                  value: t(`dev.day_${DAY_KEYS[description.dayOfWeek]}` as never),
                },
                { label: t('dev.relative'), value: relativeText },
              ].map((row) => (
                <div key={row.label} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </div>
                    <div className="break-all font-mono text-[13px] text-foreground" dir="ltr">
                      {row.value}
                    </div>
                  </div>
                  <CopyButton value={row.value} size="icon-sm" />
                </div>
              ))}
            </div>
          </ToolPanel>
        </>
      )}

      <ToolPanel title={t('dev.dateToTimestamp')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t('dev.pickDateTime')}</span>
            <Input
              type="datetime-local"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              dir="ltr"
            />
          </label>
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t('dev.result')}</span>
            {reverseDate ? (
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-secondary px-2 py-1 font-mono text-[13px] text-foreground" dir="ltr">
                  {Math.floor(reverseDate.getTime() / 1000)}
                </code>
                <CopyButton
                  value={String(Math.floor(reverseDate.getTime() / 1000))}
                  label={t('dev.copySeconds')}
                  size="sm"
                />
                <CopyButton value={String(reverseDate.getTime())} label={t('dev.copyMilliseconds')} size="sm" />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('dev.invalidDate')}</p>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t('dev.timezoneNote')}</p>
      </ToolPanel>

      <PrivacyNotice text={t('common.allProcessingText')} />
    </div>
  );
}
