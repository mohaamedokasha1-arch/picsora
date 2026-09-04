/**
 * Exchange-rate access for the currency converter.
 *
 * TECHNICAL NOTE — the only place in the new tool set that touches the network.
 * Live FX rates are inherently server-side data and cannot be derived offline.
 * The request is made from the user's own browser to a free, key-less public
 * endpoint (open.er-api.com) and carries no user input: only the base currency
 * code. Amounts typed by the user never leave the device. Results are cached in
 * localStorage for an hour so repeat visits work offline.
 */

import { safeFetchJson } from '@/lib/security/net';
import { safeJsonParse, safeRecord } from '@/lib/security/sanitize';

export const SUPPORTED_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY',
  'SAR', 'AED', 'EGP', 'KWD', 'QAR', 'BHD', 'JOD', 'TRY', 'INR', 'SEK',
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export interface RateSnapshot {
  base: string;
  rates: Record<string, number>;
  /** Epoch ms when the snapshot was fetched. */
  fetchedAt: number;
  /** Provider-reported update time, if any. */
  providerDate?: string;
  source: string;
}

const CACHE_KEY = 'piclizer:fx-rates:v1';
const MAX_AGE_MS = 60 * 60 * 1000; // 1 hour
const ENDPOINT = 'https://open.er-api.com/v6/latest/USD';
export const RATE_SOURCE = 'open.er-api.com';

/** ISO-4217-shaped keys only; anything else is dropped from the rate table. */
const CURRENCY_KEY = /^[A-Z]{3,4}$/;

const isFiniteRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1e12;

/**
 * Normalise an untrusted rate table (from the network or from localStorage)
 * into a null-prototype record of positive finite numbers.
 *
 * Guards against prototype pollution (`__proto__` / `constructor` keys),
 * NaN/Infinity poisoning and unbounded key counts.
 */
function sanitizeRates(input: unknown): Record<string, number> {
  return safeRecord<number>(input, isFiniteRate, { maxKeys: 400, keyPattern: CURRENCY_KEY });
}

/** Validate an untrusted object into a RateSnapshot, or null. */
function toSnapshot(input: unknown): RateSnapshot | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<RateSnapshot>;
  if (typeof raw.fetchedAt !== 'number' || !Number.isFinite(raw.fetchedAt)) return null;
  const rates = sanitizeRates(raw.rates);
  if (!Object.keys(rates).length) return null;
  return {
    base: typeof raw.base === 'string' && CURRENCY_KEY.test(raw.base) ? raw.base : 'USD',
    rates,
    fetchedAt: raw.fetchedAt,
    providerDate: typeof raw.providerDate === 'string' ? raw.providerDate.slice(0, 100) : undefined,
    source: RATE_SOURCE,
  };
}

export function readCache(): RateSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    // localStorage is attacker-writable from any XSS on the origin, so the
    // cached value is treated exactly like untrusted network input.
    return toSnapshot(safeJsonParse(raw ?? '', 512 * 1024));
  } catch {
    return null;
  }
}

function writeCache(snapshot: RateSnapshot): void {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    /* storage may be full or blocked — the in-memory snapshot still works */
  }
}

export function isFresh(snapshot: RateSnapshot | null): boolean {
  return Boolean(snapshot && Date.now() - snapshot.fetchedAt < MAX_AGE_MS);
}

export interface RatesOutcome {
  snapshot: RateSnapshot | null;
  stale: boolean;
  failed: boolean;
}

/** Return fresh rates, falling back to (possibly stale) cache on failure. */
export async function getRates(force = false): Promise<RatesOutcome> {
  const cached = readCache();
  if (!force && isFresh(cached)) return { snapshot: cached, stale: false, failed: false };

  try {
    // Hardened transport: https-only, no cookies, no referrer, no redirects,
    // 12s timeout and a hard body-size ceiling before parsing.
    const data = await safeFetchJson<{
      result?: string;
      base_code?: string;
      time_last_update_utc?: string;
      rates?: unknown;
    }>(ENDPOINT, { timeoutMs: 12000, maxBytes: 512 * 1024 });

    if (data.result !== 'success') throw new Error('bad payload');
    const snapshot = toSnapshot({
      base: typeof data.base_code === 'string' ? data.base_code : 'USD',
      rates: data.rates,
      fetchedAt: Date.now(),
      providerDate: typeof data.time_last_update_utc === 'string' ? data.time_last_update_utc : undefined,
      source: RATE_SOURCE,
    });
    if (!snapshot) throw new Error('bad payload');
    writeCache(snapshot);
    return { snapshot, stale: false, failed: false };
  } catch {
    return { snapshot: cached, stale: Boolean(cached), failed: true };
  }
}

/** Convert using a USD-based snapshot. */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  snapshot: RateSnapshot,
): number | null {
  // Reject non-finite input and unknown or crafted currency keys before they are
  // used to index the rate table.
  if (!Number.isFinite(amount)) return null;
  if (!CURRENCY_KEY.test(from) || !CURRENCY_KEY.test(to)) return null;
  const fromRate = from === snapshot.base ? 1 : snapshot.rates[from];
  const toRate = to === snapshot.base ? 1 : snapshot.rates[to];
  if (!isFiniteRate(fromRate) && fromRate !== 1) return null;
  if (!isFiniteRate(toRate) && toRate !== 1) return null;
  const result = (amount / fromRate) * toRate;
  return Number.isFinite(result) ? result : null;
}

export function formatMoney(value: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 4 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
