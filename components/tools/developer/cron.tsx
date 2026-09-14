'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  buildCron,
  CRON_FREQUENCIES,
  DEFAULT_CRON_OPTIONS,
  describeCron,
  validateCron,
  type CronFrequency,
  type CronOptions,
} from '@/lib/developer-tools/cron';
import {
  CheckboxRow,
  CopyButton,
  InlineError,
  PrivacyNotice,
  ResetButton,
  ToolPanel,
  ToggleGroup,
} from '../kit';

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function CronGeneratorTool() {
  const t = useTranslations();
  const [options, setOptions] = React.useState<CronOptions>({ ...DEFAULT_CRON_OPTIONS });
  const [custom, setCustom] = React.useState('');
  const [useCustom, setUseCustom] = React.useState(false);

  const expression = useCustom ? custom : buildCron(options);
  const validation = React.useMemo(() => validateCron(expression), [expression]);
  const description = React.useMemo(() => describeCron(expression), [expression]);

  const update = (patch: Partial<CronOptions>) => setOptions((prev) => ({ ...prev, ...patch }));

  const toggleDay = (day: number, checked: boolean) => {
    const days = checked
      ? [...new Set([...options.daysOfWeek, day])].sort((a, b) => a - b)
      : options.daysOfWeek.filter((d) => d !== day);
    update({ daysOfWeek: days });
  };

  const describeText = (() => {
    switch (description.kind) {
      case 'everyMinute':
        return t('dev.cronEveryMinute');
      case 'everyNMinutes':
        return t('dev.cronEveryNMinutes', { n: description.n });
      case 'everyHour':
        return t('dev.cronEveryHour', { minute: description.minute });
      case 'everyNHours':
        return t('dev.cronEveryNHours', { n: description.n, minute: description.minute });
      case 'daily':
        return t('dev.cronDaily', { time: `${String(description.hour).padStart(2, '0')}:${String(description.minute).padStart(2, '0')}` });
      case 'weekly':
        return t('dev.cronWeekly', {
          time: `${String(description.hour).padStart(2, '0')}:${String(description.minute).padStart(2, '0')}`,
          days: description.days.map((d) => t(`dev.day_${DAY_KEYS[d]}` as never)).join(', '),
        });
      case 'monthly':
        return t('dev.cronMonthly', {
          day: description.day,
          time: `${String(description.hour).padStart(2, '0')}:${String(description.minute).padStart(2, '0')}`,
        });
      case 'yearly':
        return t('dev.cronYearly', {
          month: t(`dev.month_${description.month}` as never),
          day: description.day,
          time: `${String(description.hour).padStart(2, '0')}:${String(description.minute).padStart(2, '0')}`,
        });
      default:
        return t('dev.cronCustom');
    }
  })();

  const fields = expression.trim().split(/\s+/);
  const fieldLabels = ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek'];

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('dev.cronSchedule')}
        actions={
          <ResetButton
            onClick={() => {
              setOptions({ ...DEFAULT_CRON_OPTIONS });
              setCustom('');
              setUseCustom(false);
            }}
          />
        }
      >
        <div className="space-y-4">
          <ToggleGroup
            value={options.frequency}
            onChange={(value: CronFrequency) => update({ frequency: value })}
            label={t('dev.cronFrequency')}
            options={CRON_FREQUENCIES.map((value) => ({
              value,
              label: t(`dev.cronFreq_${value}` as never),
            }))}
          />

          {(options.frequency === 'minutes' || options.frequency === 'hourly') && (
            <label className="block max-w-[220px] space-y-1.5">
              <span className="text-sm font-medium text-foreground">
                {options.frequency === 'minutes' ? t('dev.everyNMinutes') : t('dev.everyNHours')}
              </span>
              <Input
                type="number"
                min={1}
                max={59}
                value={options.interval}
                onChange={(e) => update({ interval: Number(e.target.value) })}
              />
            </label>
          )}

          {options.frequency !== 'minutes' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-foreground">{t('dev.minuteOfHour')}</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={options.minute}
                  onChange={(e) => update({ minute: Number(e.target.value) })}
                />
              </label>
              {(options.frequency === 'daily' ||
                options.frequency === 'weekly' ||
                options.frequency === 'monthly' ||
                options.frequency === 'yearly') && (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">{t('dev.hourOfDay')}</span>
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={options.hour}
                    onChange={(e) => update({ hour: Number(e.target.value) })}
                  />
                </label>
              )}
              {(options.frequency === 'monthly' || options.frequency === 'yearly') && (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">{t('dev.dayOfMonth')}</span>
                  <Input
                    type="number"
                    min={1}
                    max={31}
                    value={options.dayOfMonth}
                    onChange={(e) => update({ dayOfMonth: Number(e.target.value) })}
                  />
                </label>
              )}
              {options.frequency === 'yearly' && (
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-foreground">{t('dev.monthOfYear')}</span>
                  <Select
                    value={String(options.month)}
                    onChange={(e) => update({ month: Number(e.target.value) })}
                    options={MONTHS.map((month) => ({
                      value: String(month),
                      label: t(`dev.month_${month}` as never),
                    }))}
                  />
                </label>
              )}
            </div>
          )}

          {options.frequency === 'weekly' && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">{t('dev.daysOfWeek')}</span>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-4">
                {DAY_KEYS.map((day, index) => (
                  <CheckboxRow
                    key={day}
                    checked={options.daysOfWeek.includes(index)}
                    onChange={(checked) => toggleDay(index, checked)}
                    label={t(`dev.day_${day}` as never)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </ToolPanel>

      <ToolPanel title={t('dev.cronExpression')}>
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <code
              className="rounded-lg border border-border bg-secondary/40 px-3 py-2 font-mono text-lg font-semibold text-foreground"
              dir="ltr"
            >
              {expression || '—'}
            </code>
            <CopyButton value={expression} label={t('common.copy')} size="default" />
          </div>

          <div className="flex flex-wrap gap-2" dir="ltr">
            {fields.length === 5 &&
              fields.map((field, i) => (
                <span
                  key={`${field}-${i}`}
                  className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                >
                  <span className="text-muted-foreground">{t(`dev.cronField_${fieldLabels[i]}` as never)}: </span>
                  <span className="font-mono font-semibold">{field}</span>
                </span>
              ))}
          </div>

          {!validation.valid && <InlineError message={t('dev.cronInvalid')} />}

          <p className={cn('text-sm text-foreground', !validation.valid && 'opacity-60')}>
            {describeText}
          </p>

          <div className="flex items-center gap-3">
            <CheckboxRow checked={useCustom} onChange={setUseCustom} label={t('dev.cronUseCustom')} />
            {useCustom && (
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="*/15 9-17 * * 1-5"
                dir="ltr"
                className="max-w-[260px] font-mono"
                aria-label={t('dev.cronCustomInput')}
              />
            )}
          </div>
        </div>
      </ToolPanel>

      <PrivacyNotice text={t('common.allProcessingText')} />
    </div>
  );
}
