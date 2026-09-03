/**
 * Word-level text diff implemented from scratch (no external library).
 *
 * Uses a classic LCS dynamic-programming pass over tokens, which is exact and
 * fast enough for the input sizes a browser tool deals with. Inputs are first
 * split into words + whitespace so the diff is word-level, not line-level.
 */

export type DiffOp = 'equal' | 'insert' | 'delete';

export interface DiffPart {
  op: DiffOp;
  value: string;
}

export interface DiffStats {
  linesAdded: number;
  linesRemoved: number;
  wordsAdded: number;
  wordsRemoved: number;
  charactersChanged: number;
}

export interface DiffResult {
  parts: DiffPart[];
  stats: DiffStats;
}

function tokenizeWords(input: string): string[] {
  if (!input) return [];
  return input.match(/\s+|[^\s]+/g) ?? [];
}

/** Longest-common-subsequence diff over an arbitrary token array. */
export function diffTokens(a: string[], b: string[]): DiffPart[] {
  const n = a.length;
  const m = b.length;

  // Trim common prefix/suffix first — keeps the DP table small in practice.
  let start = 0;
  while (start < n && start < m && a[start] === b[start]) start += 1;
  let endA = n;
  let endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);

  const rows = midA.length;
  const cols = midB.length;
  const table: Uint32Array = new Uint32Array((rows + 1) * (cols + 1));
  const at = (i: number, j: number) => i * (cols + 1) + j;

  for (let i = rows - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      table[at(i, j)] =
        midA[i] === midB[j]
          ? table[at(i + 1, j + 1)] + 1
          : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
    }
  }

  const parts: DiffPart[] = [];
  const push = (op: DiffOp, value: string) => {
    const last = parts[parts.length - 1];
    if (last && last.op === op) last.value += value;
    else parts.push({ op, value });
  };

  for (let k = 0; k < start; k += 1) push('equal', a[k]);

  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (midA[i] === midB[j]) {
      push('equal', midA[i]);
      i += 1;
      j += 1;
    } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) {
      push('delete', midA[i]);
      i += 1;
    } else {
      push('insert', midB[j]);
      j += 1;
    }
  }
  while (i < rows) {
    push('delete', midA[i]);
    i += 1;
  }
  while (j < cols) {
    push('insert', midB[j]);
    j += 1;
  }
  for (let k = endA; k < n; k += 1) push('equal', a[k]);

  return parts;
}

export function diffWords(original: string, modified: string): DiffResult {
  const parts = diffTokens(tokenizeWords(original), tokenizeWords(modified));

  let wordsAdded = 0;
  let wordsRemoved = 0;
  let charactersChanged = 0;
  for (const part of parts) {
    if (part.op === 'equal') continue;
    charactersChanged += part.value.length;
    const words = part.value.trim() ? part.value.trim().split(/\s+/).length : 0;
    if (part.op === 'insert') wordsAdded += words;
    else wordsRemoved += words;
  }

  const originalLines = original ? original.split('\n') : [];
  const modifiedLines = modified ? modified.split('\n') : [];
  const common = lcsLength(originalLines, modifiedLines);
  const linesRemoved = originalLines.length - common;
  const linesAdded = modifiedLines.length - common;

  return { parts, stats: { linesAdded, linesRemoved, wordsAdded, wordsRemoved, charactersChanged } };
}

/** Render a diff as a plain-text unified-ish output for copying. */
export function diffToText(parts: DiffPart[]): string {
  return parts
    .map((p) => (p.op === 'equal' ? p.value : p.op === 'insert' ? `{+${p.value}+}` : `[-${p.value}-]`))
    .join('');
}

/** Length of the longest common subsequence of two token arrays. */
function lcsLength(a: string[], b: string[]): number {
  const cols = b.length;
  let prev = new Uint32Array(cols + 1);
  let curr = new Uint32Array(cols + 1);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = cols - 1; j >= 0; j -= 1) {
      curr[j] = a[i] === b[j] ? prev[j + 1] + 1 : Math.max(prev[j], curr[j + 1]);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
    curr.fill(0);
  }
  return prev[0];
}
