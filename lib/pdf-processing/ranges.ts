/** Pure, dependency-free page-range parsing shared by the PDF tools. */

export interface RangeParseResult {
  /** 0-based page indices in the order written. */
  indices: number[];
  /** Individual parsed groups, useful for "split by range". */
  groups: { label: string; indices: number[] }[];
  error?: 'rangeEmpty' | 'rangeFormat' | 'rangeBounds' | 'rangeDuplicate';
}

/**
 * Parse an expression like `1-3, 5, 7-10` against a document of `pageCount`
 * pages. Returns 0-based indices. Duplicates across the whole expression are
 * reported so callers can surface a precise error.
 */
export function parsePageRanges(input: string, pageCount: number): RangeParseResult {
  const empty: RangeParseResult = { indices: [], groups: [] };
  const text = input.trim();
  if (!text) return { ...empty, error: 'rangeEmpty' };

  const groups: { label: string; indices: number[] }[] = [];
  const seen = new Set<number>();
  const all: number[] = [];

  for (const rawPart of text.split(',')) {
    const part = rawPart.trim();
    if (!part) continue;
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!match) return { ...empty, error: 'rangeFormat' };
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < 1 || start > pageCount || end > pageCount) {
      return { ...empty, error: 'rangeBounds' };
    }
    const step = start <= end ? 1 : -1;
    const indices: number[] = [];
    for (let page = start; step > 0 ? page <= end : page >= end; page += step) {
      const index = page - 1;
      if (seen.has(index)) return { ...empty, error: 'rangeDuplicate' };
      seen.add(index);
      indices.push(index);
      all.push(index);
    }
    groups.push({ label: start === end ? `${start}` : `${start}-${end}`, indices });
  }

  if (!all.length) return { ...empty, error: 'rangeEmpty' };
  return { indices: all, groups };
}

/** Split `pageCount` pages into chunks of `size` pages each. */
export function chunkPages(pageCount: number, size: number): { label: string; indices: number[] }[] {
  if (size < 1) return [];
  const parts: { label: string; indices: number[] }[] = [];
  for (let start = 0; start < pageCount; start += size) {
    const indices: number[] = [];
    for (let i = start; i < Math.min(start + size, pageCount); i += 1) indices.push(i);
    const first = indices[0] + 1;
    const last = indices[indices.length - 1] + 1;
    parts.push({ label: first === last ? `${first}` : `${first}-${last}`, indices });
  }
  return parts;
}

/** Every page as its own part. */
export function everyPage(pageCount: number): { label: string; indices: number[] }[] {
  return Array.from({ length: pageCount }, (_, i) => ({ label: `${i + 1}`, indices: [i] }));
}

/** Render a selection as a compact human-readable summary: "2, 5, 8–12". */
export function summarizeSelection(indices: number[]): string {
  const pages = [...indices].map((i) => i + 1).sort((a, b) => a - b);
  if (!pages.length) return '';
  const out: string[] = [];
  let start = pages[0];
  let prev = pages[0];
  for (let i = 1; i <= pages.length; i += 1) {
    const current = pages[i];
    if (current !== prev + 1) {
      out.push(start === prev ? `${start}` : `${start}–${prev}`);
      start = current;
    }
    prev = current;
  }
  return out.join(', ');
}
