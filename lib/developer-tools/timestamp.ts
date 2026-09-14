/**
 * Unix timestamp ⇄ date & time conversion for the Timestamp Converter tool.
 * Everything is done with native Date maths — no timezone library, no API.
 */

export type TimestampUnit = 'seconds' | 'milliseconds';

export interface DateDescription {
  unixSeconds: number;
  unixMilliseconds: number;
  iso: string;
  local: string;
  utc: string;
  dateOnly: string;
  timeOnly: string;
  utcOffsetMinutes: number;
  dayOfWeek: number;
  relative: { key: 'seconds' | 'minutes' | 'hours' | 'days' | 'months' | 'years'; amount: number; past: boolean };
}

/** 13 digits (or fewer than -11 digits) means milliseconds. */
export function detectUnit(value: string): TimestampUnit {
  const digits = value.replace(/[^\d]/g, '');
  return digits.length > 11 ? 'milliseconds' : 'seconds';
}

export function timestampToDate(value: string, unit: TimestampUnit): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) return null;
  const ms = unit === 'milliseconds' ? numeric : numeric * 1000;
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

/** "2026-09-14T15:30" from <input type="datetime-local"> → Date (local time). */
export function localInputToDate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Try every plausible textual form the user may paste. */
export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return timestampToDate(trimmed, detectUnit(trimmed));
  const date = new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function relativeFromNow(date: Date, now = new Date()): DateDescription['relative'] {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const past = diffSeconds < 0;
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return { key: 'seconds', amount: abs, past };
  if (abs < 3600) return { key: 'minutes', amount: Math.round(abs / 60), past };
  if (abs < 86400) return { key: 'hours', amount: Math.round(abs / 3600), past };
  if (abs < 2592000) return { key: 'days', amount: Math.round(abs / 86400), past };
  if (abs < 31536000) return { key: 'months', amount: Math.round(abs / 2592000), past };
  return { key: 'years', amount: Math.round(abs / 31536000), past };
}

const pad = (value: number, size = 2) => String(value).padStart(size, '0');

export function describeDate(date: Date, now = new Date()): DateDescription {
  const iso = date.toISOString();
  return {
    unixSeconds: Math.floor(date.getTime() / 1000),
    unixMilliseconds: date.getTime(),
    iso,
    local: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    utc: `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`,
    dateOnly: iso.slice(0, 10),
    timeOnly: iso.slice(11, 19),
    utcOffsetMinutes: -date.getTimezoneOffset(),
    dayOfWeek: date.getDay(),
    relative: relativeFromNow(date, now),
  };
}

/** ISO-8601 week number (weeks start Monday, week 1 contains Jan 4th). */
export function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** Value for <input type="datetime-local"> in the user's own timezone. */
export function toLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function offsetLabel(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
