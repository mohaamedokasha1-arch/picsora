/**
 * JSON → TypeScript interface generator. Pure string building over
 * JSON.parse — no DOM, no network.
 */

import type { JsonValue } from './index';

export interface JsonToTsOptions {
  rootName: string;
  /** Emit `export interface` instead of plain `interface`. */
  exported: boolean;
  /** Mark null-valued / missing keys optional (`key?: type`). */
  optionalNulls: boolean;
}

const MAX_DEPTH = 12;
const MAX_KEYS = 200;

function sanitizeName(raw: string, fallback: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_$]/g, '_').replace(/^(\d)/, '_$1');
  return cleaned || fallback;
}

function toPascal(raw: string): string {
  const parts = raw.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const name = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  return sanitizeName(name || 'Root', 'Root');
}

function needsQuotes(key: string): boolean {
  return !/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key);
}

interface Collector {
  interfaces: string[];
  seen: Map<string, string>;
  counter: number;
}

function infer(value: JsonValue, key: string, depth: number, collector: Collector, options: JsonToTsOptions): string {
  if (value === null) return 'null';
  const type = typeof value;
  if (type === 'string') return 'string';
  if (type === 'number') return 'number';
  if (type === 'boolean') return 'boolean';
  if (depth >= MAX_DEPTH) return 'unknown';
  if (Array.isArray(value)) {
    if (!value.length) return 'unknown[]';
    const kinds = new Set(value.slice(0, 32).map((item) => infer(item, key, depth + 1, collector, options)));
    if (kinds.size === 1) {
      const only = [...kinds][0];
      return only.includes('|') ? `(${only})[]` : `${only}[]`;
    }
    return `(${( [...kinds] ).join(' | ')})[]`;
  }
  const name = toPascal(key);
  const signature = JSON.stringify(Object.keys(value).slice(0, MAX_KEYS).sort());
  const known = collector.seen.get(signature);
  if (known) return known;
  let finalName = name;
  while (collector.interfaces.some((i) => i.includes(`interface ${finalName} `))) {
    collector.counter += 1;
    finalName = `${name}${collector.counter}`;
  }
  collector.seen.set(signature, finalName);
  const entries = Object.entries(value).slice(0, MAX_KEYS);
  const lines = entries.map(([k, v]) => {
    const field = needsQuotes(k) ? JSON.stringify(k) : k;
    const optional = options.optionalNulls && (v === null || v === undefined);
    return `  ${field}${optional ? '?' : ''}: ${infer(v as JsonValue, k, depth + 1, collector, options)};`;
  });
  const keyword = options.exported ? 'export interface' : 'interface';
  collector.interfaces.push(`${keyword} ${finalName} {\n${lines.join('\n')}\n}`);
  return finalName;
}

export interface JsonToTsResult {
  ok: boolean;
  code?: string;
  error?: string;
  interfaces?: number;
}

/** Convert a JSON document string into TypeScript interfaces. */
export function jsonToTypeScript(input: string, options: JsonToTsOptions): JsonToTsResult {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: 'empty' };
  if (trimmed.length > 512 * 1024) return { ok: false, error: 'too-large' };
  let value: JsonValue;
  try {
    value = JSON.parse(trimmed) as JsonValue;
  } catch {
    return { ok: false, error: 'parse' };
  }
  const rootName = toPascal(options.rootName.trim() || 'Root');
  if (value === null || typeof value !== 'object') {
    const keyword = options.exported ? 'export type' : 'type';
    return { ok: true, code: `${keyword} ${rootName} = ${infer(value, rootName, 0, { interfaces: [], seen: new Map(), counter: 0 }, options)};\n`, interfaces: 0 };
  }
  if (Array.isArray(value)) {
    const collector: Collector = { interfaces: [], seen: new Map(), counter: 0 };
    const item = value.length ? infer(value[0], rootName, 1, collector, options) : 'unknown';
    const keyword = options.exported ? 'export type' : 'type';
    const head = `${keyword} ${rootName} = ${item}[];`;
    return { ok: true, code: `${head}\n\n${collector.interfaces.join('\n\n')}\n`.trim() + '\n', interfaces: collector.interfaces.length };
  }
  const collector: Collector = { interfaces: [], seen: new Map(), counter: 0 };
  // Seed the root name so the top interface uses it.
  collector.seen.set(JSON.stringify(Object.keys(value).slice(0, MAX_KEYS).sort()), rootName);
  const entries = Object.entries(value).slice(0, MAX_KEYS);
  const lines = entries.map(([k, v]) => {
    const field = needsQuotes(k) ? JSON.stringify(k) : k;
    const optional = options.optionalNulls && (v === null || v === undefined);
    return `  ${field}${optional ? '?' : ''}: ${infer(v as JsonValue, k, 1, collector, options)};`;
  });
  const keyword = options.exported ? 'export interface' : 'interface';
  const root = `${keyword} ${rootName} {\n${lines.join('\n')}\n}`;
  return { ok: true, code: `${root}\n\n${collector.interfaces.join('\n\n')}\n`.replace(/\n{3,}/g, '\n\n').trim() + '\n', interfaces: collector.interfaces.length + 1 };
}
