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

export function readCache(): RateSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RateSnapshot;
    if (!parsed?.rates || typeof parsed.fetchedAt !== 'number') return null;
    return parsed;
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
    const response = await fetch(ENDPOINT, { cache: 'no-store' });
    if (!response.ok) throw new Error('bad status');
    const data = (await response.json()) as {
      result?: string;
      base_code?: string;
      time_last_update_utc?: string;
      rates?: Record<string, number>;
    };
    if (data.result !== 'success' || !data.rates) throw new Error('bad payload');
    const snapshot: RateSnapshot = {
      base: data.base_code ?? 'USD',
      rates: data.rates,
      fetchedAt: Date.now(),
      providerDate: data.time_last_update_utc,
      source: RATE_SOURCE,
    };
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
  const fromRate = from === snapshot.base ? 1 : snapshot.rates[from];
  const toRate = to === snapshot.base ? 1 : snapshot.rates[to];
  if (!fromRate || !toRate) return null;
  return (amount / fromRate) * toRate;
}

export function formatMoney(value: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 4 }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}
