/**
 * Cron expression builder + reader for the Cron Generator tool.
 * Five classic fields (minute, hour, day-of-month, month, day-of-week).
 *
 * The describer returns a *structured* result instead of a sentence, so the
 * UI can render it in English or Arabic without string surgery.
 */

export type CronFrequency = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const CRON_FREQUENCIES: CronFrequency[] = ['minutes', 'hourly', 'daily', 'weekly', 'monthly', 'yearly'];

export interface CronOptions {
  frequency: CronFrequency;
  /** Every N minutes (frequency = minutes) or every N hours (frequency = hourly). */
  interval: number;
  /** Minute of the hour, 0–59. */
  minute: number;
  /** Hour of the day, 0–23. */
  hour: number;
  /** 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
  /** 1–31. */
  dayOfMonth: number;
  /** 1–12. */
  month: number;
}

export const DEFAULT_CRON_OPTIONS: CronOptions = {
  frequency: 'daily',
  interval: 15,
  minute: 0,
  hour: 9,
  daysOfWeek: [1],
  dayOfMonth: 1,
  month: 1,
};

const clampInt = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(Number.isFinite(value) ? value : min)));

/** Build a five-field cron expression from the simple controls. */
export function buildCron(options: CronOptions): string {
  const minute = clampInt(options.minute, 0, 59);
  const hour = clampInt(options.hour, 0, 23);
  const interval = clampInt(options.interval, 1, 59);

  switch (options.frequency) {
    case 'minutes':
      return interval === 1 ? '* * * * *' : `*/${interval} * * * *`;
    case 'hourly':
      return interval === 1 ? `${minute} * * * *` : `${minute} */${interval} * * *`;
    case 'weekly': {
      const days = (options.daysOfWeek.length ? options.daysOfWeek : [1])
        .map((d) => clampInt(d, 0, 6))
        .sort((a, b) => a - b);
      return `${minute} ${hour} * * ${days.join(',')}`;
    }
    case 'monthly':
      return `${minute} ${hour} ${clampInt(options.dayOfMonth, 1, 31)} * *`;
    case 'yearly':
      return `${minute} ${hour} ${clampInt(options.dayOfMonth, 1, 31)} ${clampInt(options.month, 1, 12)} *`;
    case 'daily':
    default:
      return `${minute} ${hour} * * *`;
  }
}

/* ------------------------------------------------------------- validation */

const FIELD_RANGES: [number, number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week
];

/** Validate one field; returns true when every list item is in range. */
export function isValidCronField(field: string, min: number, max: number): boolean {
  if (!field.trim()) return false;
  return field.split(',').every((part) => {
    const [range, step] = part.split('/');
    if (step !== undefined) {
      const stepNumber = Number(step);
      if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > max - min + 1) return false;
    }
    if (range === '*') return true;
    const bounds = range.split('-');
    if (bounds.length > 2) return false;
    const numbers = bounds.map((value) => Number(value));
    if (numbers.some((value) => !Number.isInteger(value) || value < min || value > max)) return false;
    return bounds.length === 1 || numbers[0] <= numbers[1];
  });
}

export interface CronValidation {
  valid: boolean;
  /** Indexes (0-based) of the fields that are wrong — empty when valid. */
  invalidFields: number[];
}

export function validateCron(expression: string): CronValidation {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return { valid: false, invalidFields: [0, 1, 2, 3, 4] };
  const invalidFields = fields
    .map((field, i) => (isValidCronField(field, FIELD_RANGES[i][0], FIELD_RANGES[i][1]) ? -1 : i))
    .filter((i) => i >= 0);
  return { valid: invalidFields.length === 0, invalidFields };
}

/* --------------------------------------------------------------- reader */

export type CronDescription =
  | { kind: 'everyMinute' }
  | { kind: 'everyNMinutes'; n: number }
  | { kind: 'everyHour'; minute: number }
  | { kind: 'everyNHours'; n: number; minute: number }
  | { kind: 'daily'; minute: number; hour: number }
  | { kind: 'weekly'; minute: number; hour: number; days: number[] }
  | { kind: 'monthly'; minute: number; hour: number; day: number }
  | { kind: 'yearly'; minute: number; hour: number; day: number; month: number }
  | { kind: 'custom'; expression: string };

const isSimpleNumber = (field: string): boolean => /^\d+$/.test(field);
const isStep = (field: string): number | null => {
  const match = field.match(/^\*\/(\d+)$/);
  return match ? Number(match[1]) : null;
};

/**
 * Human-readable meaning of a cron expression. Understands the shapes the
 * builder produces plus the common hand-written ones; anything else is
 * reported as "custom" with the raw expression shown next to it.
 */
export function describeCron(expression: string): CronDescription {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return { kind: 'custom', expression };
  const [minuteField, hourField, domField, monthField, dowField] = fields;

  if (minuteField === '*' && hourField === '*' && domField === '*' && monthField === '*' && dowField === '*') {
    return { kind: 'everyMinute' };
  }

  const minuteStep = isStep(minuteField);
  if (minuteStep !== null && hourField === '*' && domField === '*' && monthField === '*' && dowField === '*') {
    return minuteStep === 1 ? { kind: 'everyMinute' } : { kind: 'everyNMinutes', n: minuteStep };
  }

  if (isSimpleNumber(minuteField) && hourField === '*' && domField === '*' && monthField === '*' && dowField === '*') {
    return { kind: 'everyHour', minute: Number(minuteField) };
  }

  const hourStep = isStep(hourField);
  if (isSimpleNumber(minuteField) && hourStep !== null && domField === '*' && monthField === '*' && dowField === '*') {
    return { kind: 'everyNHours', n: hourStep, minute: Number(minuteField) };
  }

  if (!isSimpleNumber(minuteField) || !isSimpleNumber(hourField)) {
    return { kind: 'custom', expression };
  }
  const minute = Number(minuteField);
  const hour = Number(hourField);

  if (domField === '*' && monthField === '*' && dowField === '*') return { kind: 'daily', minute, hour };

  if (domField === '*' && monthField === '*' && dowField !== '*') {
    const days = dowField
      .split(',')
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0 && value <= 6);
    if (days.length) return { kind: 'weekly', minute, hour, days: days.sort((a, b) => a - b) };
    return { kind: 'custom', expression };
  }

  if (isSimpleNumber(domField) && monthField === '*' && dowField === '*') {
    return { kind: 'monthly', minute, hour, day: Number(domField) };
  }

  if (isSimpleNumber(domField) && isSimpleNumber(monthField) && dowField === '*') {
    return { kind: 'yearly', minute, hour, day: Number(domField), month: Number(monthField) };
  }

  return { kind: 'custom', expression };
}
