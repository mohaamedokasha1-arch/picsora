/**
 * JSON ⇄ CSV conversion for the JSON ↔ CSV Converter tool.
 * Small, dependency-free and fully offline.
 */

import { parseJson, type JsonValue } from './index';

export type Delimiter = ',' | ';' | '\t' | '|';

export const DELIMITERS: Delimiter[] = [',', ';', '\t', '|'];

export interface JsonToCsvOptions {
  delimiter: Delimiter;
  /** Expand nested objects into dotted column names instead of JSON text. */
  flatten: boolean;
  /** Write the header row. */
  header: boolean;
}

export interface CsvToJsonOptions {
  /** 'auto' sniffs the delimiter from the header line. */
  delimiter: Delimiter | 'auto';
  /** Convert numeric/boolean/null-looking cells to real JSON values. */
  types: boolean;
}

export type ConversionResult<T> = { ok: true; value: T } | { ok: false; error: string };

/* ------------------------------------------------------------- escaping */

function escapeCell(value: string, delimiter: Delimiter): string {
  if (value.includes('"')) value = value.replace(/"/g, '""');
  if (value.includes(delimiter) || value.includes('"') || /[\r\n]/.test(value)) {
    return `"${value}"`;
  }
  return value;
}

function cellOf(value: JsonValue): string {
  if (value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

/** Flatten an object into {"a.b": value} so nested data keeps its own column. */
function flattenRow(row: Record<string, JsonValue>, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    const name = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flattenRow(value as Record<string, JsonValue>, name));
    } else {
      out[name] = cellOf(value);
    }
  }
  return out;
}

/* ---------------------------------------------------------- JSON → CSV */

export function jsonToCsv(input: string, options: JsonToCsvOptions): ConversionResult<{ csv: string; rows: number; columns: string[] }> {
  const parsed = parseJson(input);
  if (!parsed.ok || parsed.value === undefined) {
    return { ok: false, error: 'invalidJson' };
  }

  const value = parsed.value;
  let records: JsonValue[];
  if (Array.isArray(value)) records = value;
  else records = [value];
  if (!records.length) return { ok: false, error: 'emptyData' };

  const rows: Record<string, string>[] = [];
  const columns: string[] = [];
  const addColumns = (keys: string[]) => {
    for (const key of keys) if (!columns.includes(key)) columns.push(key);
  };

  for (const record of records) {
    if (record !== null && typeof record === 'object' && !Array.isArray(record)) {
      const row = options.flatten
        ? flattenRow(record as Record<string, JsonValue>)
        : Object.fromEntries(Object.entries(record).map(([k, v]) => [k, cellOf(v)]));
      addColumns(Object.keys(row));
      rows.push(row);
    } else {
      addColumns(['value']);
      rows.push({ value: cellOf(record) });
    }
  }

  const lines: string[] = [];
  if (options.header) lines.push(columns.map((c) => escapeCell(c, options.delimiter)).join(options.delimiter));
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(row[column] ?? '', options.delimiter)).join(options.delimiter));
  }

  return { ok: true, value: { csv: lines.join('\n'), rows: rows.length, columns } };
}

/* ---------------------------------------------------------- CSV → JSON */

/** RFC 4180 style parser: quoted cells, escaped quotes, CRLF or LF. */
export function parseCsv(text: string, delimiter: Delimiter): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char === '\r') {
      // handled by the \n branch
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Drop a trailing empty row produced by a final newline.
  return rows.filter((r, i) => !(i === rows.length - 1 && r.length === 1 && r[0] === ''));
}

/** Guess the delimiter by counting candidates outside quotes on the header. */
export function sniffDelimiter(text: string): Delimiter {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  let best: Delimiter = ',';
  let bestCount = -1;
  for (const candidate of DELIMITERS) {
    let count = 0;
    let inQuotes = false;
    for (const char of firstLine) {
      if (char === '"') inQuotes = !inQuotes;
      else if (!inQuotes && char === candidate) count += 1;
    }
    if (count > bestCount) {
      bestCount = count;
      best = candidate;
    }
  }
  return best;
}

function typedCell(cell: string, types: boolean): JsonValue {
  if (!types) return cell;
  const trimmed = cell.trim();
  if (trimmed === '') return '';
  if (/^(true|false)$/i.test(trimmed)) return trimmed.toLowerCase() === 'true';
  if (/^null$/i.test(trimmed)) return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : cell;
  }
  return cell;
}

export function csvToJson(
  input: string,
  options: CsvToJsonOptions,
): ConversionResult<{ json: string; rows: number; columns: string[] }> {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'emptyData' };

  const delimiter = options.delimiter === 'auto' ? sniffDelimiter(trimmed) : options.delimiter;
  const rows = parseCsv(trimmed, delimiter);
  if (!rows.length) return { ok: false, error: 'emptyData' };

  const [headerRow, ...bodyRows] = rows;
  const columns = headerRow.map((cell, i) => (cell.trim() ? cell.trim() : `column${i + 1}`));
  const dedupedColumns = columns.map((column, i) => (columns.indexOf(column) === i ? column : `${column}_${i}`));

  const records = bodyRows.map((row) => {
    const record: Record<string, JsonValue> = {};
    dedupedColumns.forEach((column, i) => {
      record[column] = typedCell(row[i] ?? '', options.types);
    });
    return record;
  });

  return {
    ok: true,
    value: { json: JSON.stringify(records, null, 2), rows: records.length, columns: dedupedColumns },
  };
}
