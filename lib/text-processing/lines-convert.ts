/**
 * Line-oriented text conversions: plain text ⇄ JSON arrays and CSV rows.
 * Pure functions, no DOM — safe for huge pastes and unit tests.
 */

export interface LinesToJsonOptions {
  /** Drop empty lines instead of keeping them as "". */
  skipEmpty: boolean;
  /** Trim each line. */
  trim: boolean;
  /** Parse each line as JSON when it looks like an object/array/number. */
  smartTypes: boolean;
}

function smartValue(line: string): unknown {
  const t = line.trim();
  if (/^(-?\d+(\.\d+)?|true|false|null)$/.test(t)) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return line;
    }
  }
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return line;
    }
  }
  return line;
}

/** Convert text lines into a JSON array string. */
export function linesToJson(text: string, options: LinesToJsonOptions): { json: string; count: number } {
  const raw = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of raw) {
    const value = options.trim ? line.trim() : line;
    if (options.skipEmpty && !value) continue;
    kept.push(value);
  }
  const values = options.smartTypes ? kept.map(smartValue) : kept;
  return { json: JSON.stringify(values, null, 2), count: kept.length };
}

export type CsvInputDelimiter = 'tab' | 'semicolon' | 'pipe' | 'comma' | 'space';

export const CSV_DELIMITERS: Record<CsvInputDelimiter, string> = {
  tab: '\t',
  semicolon: ';',
  pipe: '|',
  comma: ',',
  space: ' ',
};

function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export interface LinesToCsvOptions {
  delimiter: CsvInputDelimiter;
  skipEmpty: boolean;
  /** First line is a header row (kept as-is, reported separately). */
  hasHeader: boolean;
}

/** Convert delimiter-separated lines into RFC 4180 CSV. */
export function linesToCsv(
  text: string,
  options: LinesToCsvOptions,
): { csv: string; rows: number; cols: number } {
  const sep = CSV_DELIMITERS[options.delimiter] ?? '\t';
  const lines = text.split(/\r?\n/);
  const rows: string[][] = [];
  for (const line of lines) {
    if (options.skipEmpty && !line.trim()) continue;
    rows.push(options.delimiter === 'space' ? line.trim().split(/\s+/) : line.split(sep));
  }
  const cols = rows.reduce((n, r) => Math.max(n, r.length), 0);
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  return { csv: csv ? `${csv}\r\n` : '', rows: rows.length, cols };
}
