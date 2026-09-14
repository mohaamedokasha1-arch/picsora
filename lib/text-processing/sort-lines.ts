/**
 * Line sorting for the Line Sorter tool: alphabetical, reverse, numeric
 * (ascending/descending) and by length, with the usual tidy-up options.
 */

export type SortMode =
  | 'az'
  | 'za'
  | 'numericAsc'
  | 'numericDesc'
  | 'lengthAsc'
  | 'lengthDesc'
  | 'reverse'
  | 'shuffle';

export const SORT_MODES: SortMode[] = [
  'az',
  'za',
  'numericAsc',
  'numericDesc',
  'lengthAsc',
  'lengthDesc',
  'reverse',
  'shuffle',
];

export interface SortLinesOptions {
  mode: SortMode;
  /** Case-sensitive comparison (off by default, like most list tools). */
  caseSensitive?: boolean;
  /** Trim leading/trailing whitespace on every line. */
  trim?: boolean;
  /** Drop empty lines. */
  removeEmpty?: boolean;
  /** Keep only the first occurrence of equal lines. */
  removeDuplicates?: boolean;
}

export interface SortLinesResult {
  text: string;
  linesIn: number;
  linesOut: number;
  duplicatesRemoved: number;
  emptyRemoved: number;
}

/** First number in a line, so "Item 12" sorts as 12. */
export function firstNumberIn(line: string): number | null {
  const match = line.match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const value = Number(match[0].replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

function comparator(mode: SortMode, caseSensitive: boolean): (a: string, b: string) => number {
  const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: caseSensitive ? 'variant' : 'base',
  });
  switch (mode) {
    case 'za':
      return (a, b) => collator.compare(b, a);
    case 'numericAsc':
    case 'numericDesc': {
      const direction = mode === 'numericAsc' ? 1 : -1;
      return (a, b) => {
        const na = firstNumberIn(a);
        const nb = firstNumberIn(b);
        // Lines without a number keep their relative order at the end.
        if (na === null && nb === null) return 0;
        if (na === null) return 1;
        if (nb === null) return -1;
        return (na - nb) * direction;
      };
    }
    case 'lengthAsc':
      return (a, b) => a.length - b.length;
    case 'lengthDesc':
      return (a, b) => b.length - a.length;
    default:
      return (a, b) => collator.compare(a, b);
  }
}

export function sortLines(input: string, options: SortLinesOptions): SortLinesResult {
  const {
    mode,
    caseSensitive = false,
    trim = true,
    removeEmpty = true,
    removeDuplicates = false,
  } = options;

  const rawLines = input.split(/\r?\n/);
  let lines = rawLines.map((line) => (trim ? line.trim() : line));

  let emptyRemoved = 0;
  if (removeEmpty) {
    const before = lines.length;
    lines = lines.filter((line) => line.trim().length > 0);
    emptyRemoved = before - lines.length;
  }

  let duplicatesRemoved = 0;
  if (removeDuplicates) {
    const seen = new Set<string>();
    const unique: string[] = [];
    for (const line of lines) {
      const key = caseSensitive ? line : line.toLowerCase();
      if (seen.has(key)) {
        duplicatesRemoved += 1;
        continue;
      }
      seen.add(key);
      unique.push(line);
    }
    lines = unique;
  }

  let sorted: string[];
  if (mode === 'reverse') sorted = [...lines].reverse();
  else if (mode === 'shuffle') sorted = shuffle(lines);
  else sorted = [...lines].sort(comparator(mode, caseSensitive));

  return {
    text: sorted.join('\n'),
    linesIn: rawLines.length,
    linesOut: sorted.length,
    duplicatesRemoved,
    emptyRemoved,
  };
}

/** Fisher–Yates with the platform RNG — no dependency, no bias. */
function shuffle(lines: string[]): string[] {
  const out = [...lines];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
