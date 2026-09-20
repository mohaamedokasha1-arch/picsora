/**
 * Frequency analysis for the Text Frequency Counter tool.
 *
 * Deliberately narrower than `analyzeText` (the word counter): this module
 * only builds ranked frequency tables — word ranking and character ranking —
 * with the filters a frequency table needs. Sentence / paragraph / reading
 * time statistics stay with the word counter, so the two tools never report
 * the same headline numbers.
 */

import { containsArabic, splitWords, stopWordsFor } from './index';

export type FrequencyMode = 'words' | 'characters';
export type FrequencySort = 'count' | 'alpha';

export interface FrequencyOptions {
  mode: FrequencyMode;
  /** Merge "The" and "the" into one term. */
  ignoreCase: boolean;
  /** Drop stop words of the detected language (English or Arabic). */
  ignoreStopWords: boolean;
  /** Count digit-only tokens (years, IDs, prices) in word mode. */
  includeNumbers: boolean;
  /** Ignore terms shorter than this many characters. */
  minLength: number;
  /** How many rows to return — 0 means every term. */
  limit: number;
  sort: FrequencySort;
}

export const defaultFrequencyOptions: FrequencyOptions = {
  mode: 'words',
  ignoreCase: true,
  ignoreStopWords: false,
  includeNumbers: true,
  minLength: 1,
  limit: 25,
  sort: 'count',
};

export interface FrequencyEntry {
  term: string;
  count: number;
  /** Share of all counted terms, in percent. */
  percent: number;
}

export interface FrequencyResult {
  /** Ranked rows, already limited. */
  entries: FrequencyEntry[];
  /** Terms counted after filtering. */
  total: number;
  /** Distinct terms after filtering. */
  unique: number;
  /** Terms that appear exactly once. */
  once: number;
  /** Highest count in the table (0 when empty). */
  maxCount: number;
  /** Percent of all terms covered by the rows that are shown. */
  topShare: number;
  /** Language whose stop words were used. */
  language: 'en' | 'ar';
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base' });

export function countFrequency(input: string, options: FrequencyOptions): FrequencyResult {
  const language: 'en' | 'ar' = containsArabic(input) ? 'ar' : 'en';
  const stop = options.ignoreStopWords ? stopWordsFor(language) : null;
  const counts = new Map<string, number>();
  let total = 0;

  const add = (term: string) => {
    counts.set(term, (counts.get(term) ?? 0) + 1);
    total += 1;
  };

  if (options.mode === 'characters') {
    for (const char of input) {
      // Letters and digits only: whitespace, punctuation and symbols carry no
      // useful frequency signal and would swamp the table.
      if (!/[\p{L}\p{N}]/u.test(char)) continue;
      add(options.ignoreCase ? char.toLowerCase() : char);
    }
  } else {
    for (const token of splitWords(input)) {
      const term = options.ignoreCase ? token.toLowerCase() : token;
      if (term.length < options.minLength) continue;
      if (!options.includeNumbers && !/\p{L}/u.test(term)) continue;
      if (stop?.has(term)) continue;
      add(term);
    }
  }

  const unique = counts.size;
  let once = 0;
  // Tracked while building the table instead of `Math.max(...all.map(...))`:
  // spreading that many values into a call overflows V8's argument limit past
  // ~130k distinct terms and throws a RangeError out of the useMemo that
  // renders this tool.
  let maxCount = 0;
  const all: { term: string; count: number }[] = [];
  for (const [term, count] of counts) {
    if (count === 1) once += 1;
    if (count > maxCount) maxCount = count;
    all.push({ term, count });
  }

  all.sort((a, b) =>
    options.sort === 'alpha'
      ? collator.compare(a.term, b.term) || a.term.localeCompare(b.term)
      : b.count - a.count || collator.compare(a.term, b.term),
  );

  const limited = options.limit > 0 ? all.slice(0, options.limit) : all;
  const entries = limited.map((entry) => ({
    term: entry.term,
    count: entry.count,
    percent: total > 0 ? (entry.count / total) * 100 : 0,
  }));

  const shown = entries.reduce((sum, entry) => sum + entry.count, 0);

  return {
    entries,
    total,
    unique,
    once,
    maxCount,
    topShare: total > 0 ? (shown / total) * 100 : 0,
    language,
  };
}

/* --------------------------------------------------------------- exports */

/** Quote a CSV cell (terms may contain commas or quotes when case-insensitive is off). */
function cell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function frequencyToCsv(result: FrequencyResult, headers: [string, string, string]): string {
  const rows = result.entries.map((entry) =>
    [cell(entry.term), String(entry.count), entry.percent.toFixed(2)].join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

export interface FrequencyJson {
  total: number;
  unique: number;
  once: number;
  language: 'en' | 'ar';
  items: { term: string; count: number; percent: number }[];
}

export function frequencyToJson(result: FrequencyResult): string {
  const payload: FrequencyJson = {
    total: result.total,
    unique: result.unique,
    once: result.once,
    language: result.language,
    items: result.entries.map(({ term, count, percent }) => ({
      term,
      count,
      percent: Number(percent.toFixed(2)),
    })),
  };
  return JSON.stringify(payload, null, 2);
}
