/**
 * In-document search + document comparison over extracted PDF text.
 * Pure functions — the pdf.js extraction itself lives in `./text`.
 */

export interface PdfMatch {
  page: number; // 1-based
  /** Character offset of the match within the page text. */
  index: number;
  /** Surrounding context with the match intact (for display/escaping by UI). */
  context: string;
}

export interface PdfSearchReport {
  query: string;
  /** Total matches across the document. */
  total: number;
  /** Matches per page (1-based page → count). */
  perPage: { page: number; count: number }[];
  /** First N matches with context (bounded for rendering). */
  matches: PdfMatch[];
}

const MAX_MATCHES = 200;
const CONTEXT_CHARS = 60;

/** Find all occurrences of `query` across extracted page strings. */
export function searchPdfText(pages: string[], query: string, caseSensitive = false): PdfSearchReport {
  const q = query.trim();
  if (!q) return { query: '', total: 0, perPage: [], matches: [] };
  const needle = caseSensitive ? q : q.toLowerCase();
  const matches: PdfMatch[] = [];
  const perPage: { page: number; count: number }[] = [];
  let total = 0;

  pages.forEach((text, pageIndex) => {
    const haystack = caseSensitive ? text : text.toLowerCase();
    let from = 0;
    let count = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at < 0) break;
      count += 1;
      total += 1;
      if (matches.length < MAX_MATCHES) {
        const start = Math.max(0, at - CONTEXT_CHARS);
        const end = Math.min(text.length, at + q.length + CONTEXT_CHARS);
        matches.push({
          page: pageIndex + 1,
          index: at,
          context: `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`,
        });
      }
      from = at + Math.max(1, q.length);
      // Safety bound for pathological single-page matches.
      if (total > 100000) break;
    }
    if (count > 0) perPage.push({ page: pageIndex + 1, count });
  });

  return { query: q.slice(0, 200), total, perPage, matches };
}

export interface PdfCompareSide {
  name: string;
  pages: number;
  chars: number;
}

export interface PdfCompareReport {
  a: PdfCompareSide;
  b: PdfCompareSide;
  /** Per-page character-count deltas (positive = B longer). */
  pageDeltas: { page: number; aChars: number; bChars: number; delta: number }[];
  /**
   * Rough whole-document similarity 0–100 based on page-count and
   * length proximity. Honest label: a heuristic, not a diff.
   */
  similarity: number;
  identicalText: boolean;
}

/**
 * Compare two PDFs by structure + extracted text length. This answers "are
 * these the same document / which is longer" without claiming a word-level
 * diff (use Text Diff for pasted passages).
 */
export function comparePdfTexts(
  aName: string,
  aPages: string[],
  bName: string,
  bPages: string[],
): PdfCompareReport {
  const aChars = aPages.reduce((n, p) => n + p.length, 0);
  const bChars = bPages.reduce((n, p) => n + p.length, 0);
  const maxPages = Math.max(aPages.length, bPages.length, 1);
  const pageDeltas = Array.from({ length: maxPages }, (_, i) => {
    const ac = aPages[i]?.length ?? 0;
    const bc = bPages[i]?.length ?? 0;
    return { page: i + 1, aChars: ac, bChars: bc, delta: bc - ac };
  });
  const identicalText =
    aPages.length === bPages.length && aPages.every((text, i) => text === bPages[i]);
  // Heuristic: page-count agreement (50%) + length agreement (50%).
  const pageScore = 1 - Math.abs(aPages.length - bPages.length) / maxPages;
  const maxChars = Math.max(aChars, bChars, 1);
  const lenScore = 1 - Math.abs(aChars - bChars) / maxChars;
  const similarity = identicalText ? 100 : Math.max(0, Math.round((pageScore * 0.5 + lenScore * 0.5) * 100));
  return {
    a: { name: aName.slice(0, 120), pages: aPages.length, chars: aChars },
    b: { name: bName.slice(0, 120), pages: bPages.length, chars: bChars },
    pageDeltas: pageDeltas.slice(0, 500),
    similarity,
    identicalText,
  };
}
