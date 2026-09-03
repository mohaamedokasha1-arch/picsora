/**
 * Shared developer-tool primitives. Everything here is pure and runs in the
 * browser only — no code, text or file the user provides is ever transmitted.
 */

/* ------------------------------------------------------------------- JSON */

export interface JsonParseError {
  message: string;
  line: number;
  column: number;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface JsonResult {
  ok: boolean;
  value?: JsonValue;
  error?: JsonParseError;
}

/** Parse JSON and translate the engine error into a line/column position. */
export function parseJson(input: string): JsonResult {
  try {
    return { ok: true, value: JSON.parse(input) as JsonValue };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    const posMatch = /position (\d+)/.exec(message);
    let line = 1;
    let column = 1;
    if (posMatch) {
      const position = Number(posMatch[1]);
      const before = input.slice(0, position);
      line = before.split('\n').length;
      column = position - before.lastIndexOf('\n');
    }
    return { ok: false, error: { message, line, column } };
  }
}

export function formatJson(input: string, indent: number | '\t'): JsonResult & { text?: string } {
  const parsed = parseJson(input);
  if (!parsed.ok) return parsed;
  return { ...parsed, text: JSON.stringify(parsed.value, null, indent === '\t' ? '\t' : indent) };
}

export function minifyJson(input: string): JsonResult & { text?: string } {
  const parsed = parseJson(input);
  if (!parsed.ok) return parsed;
  return { ...parsed, text: JSON.stringify(parsed.value) };
}

export function sortJsonKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJsonKeys);
  if (value && typeof value === 'object') {
    const out: { [key: string]: JsonValue } = {};
    for (const key of Object.keys(value).sort()) out[key] = sortJsonKeys(value[key]);
    return out;
  }
  return value;
}

export interface JsonStats {
  depth: number;
  keys: number;
  values: number;
  types: Record<string, number>;
}

export function jsonStats(value: JsonValue): JsonStats {
  const types: Record<string, number> = {};
  let keys = 0;
  let values = 0;
  let depth = 0;

  const walk = (node: JsonValue, level: number) => {
    depth = Math.max(depth, level);
    const type = node === null ? 'null' : Array.isArray(node) ? 'array' : typeof node;
    types[type] = (types[type] ?? 0) + 1;
    values += 1;
    if (Array.isArray(node)) node.forEach((child) => walk(child, level + 1));
    else if (node && typeof node === 'object') {
      for (const key of Object.keys(node)) {
        keys += 1;
        walk(node[key], level + 1);
      }
    }
  };
  walk(value, 1);
  return { depth, keys, values, types };
}

/* -------------------------------------------------------------------- XML */

export interface XmlValidation {
  ok: boolean;
  error?: string;
  elements: number;
  attributes: number;
  depth: number;
}

function parseXmlDoc(input: string): { doc: Document | null; error?: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) return { doc: null, error: errorNode.textContent?.trim() || 'Invalid XML' };
  return { doc };
}

export function validateXml(input: string): XmlValidation {
  const { doc, error } = parseXmlDoc(input);
  if (!doc) return { ok: false, error, elements: 0, attributes: 0, depth: 0 };
  let elements = 0;
  let attributes = 0;
  let depth = 0;
  const walk = (node: Element, level: number) => {
    elements += 1;
    attributes += node.attributes.length;
    depth = Math.max(depth, level);
    Array.from(node.children).forEach((child) => walk(child, level + 1));
  };
  if (doc.documentElement) walk(doc.documentElement, 1);
  return { ok: true, elements, attributes, depth };
}

/** Pretty-print XML with a configurable indent (DOM-validated, string-based). */
export function formatXml(input: string, indentSize = 2): { ok: boolean; text?: string; error?: string } {
  const { doc, error } = parseXmlDoc(input);
  if (!doc) return { ok: false, error };
  const pad = ' '.repeat(indentSize);
  const compact = input.replace(/\r\n/g, '\n').replace(/>\s+</g, '><').trim();
  const tokens = compact.match(/<[^>]+>|[^<]+/g) ?? [];

  const lines: string[] = [];
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i].trim();
    if (!token) continue;
    if (token.startsWith('<?') || token.startsWith('<!')) {
      lines.push(pad.repeat(depth) + token);
      continue;
    }
    if (token.startsWith('</')) {
      depth = Math.max(0, depth - 1);
      lines.push(pad.repeat(depth) + token);
      continue;
    }
    if (token.startsWith('<')) {
      const selfClosing = token.endsWith('/>');
      const next = tokens[i + 1]?.trim() ?? '';
      const afterNext = tokens[i + 2]?.trim() ?? '';
      // Keep `<tag>text</tag>` on a single line.
      if (!selfClosing && next && !next.startsWith('<') && afterNext.startsWith('</')) {
        lines.push(pad.repeat(depth) + token + next + afterNext);
        i += 2;
        continue;
      }
      lines.push(pad.repeat(depth) + token);
      if (!selfClosing) depth += 1;
      continue;
    }
    lines.push(pad.repeat(depth) + token);
  }
  return { ok: true, text: lines.join('\n') };
}

export function minifyXml(input: string): { ok: boolean; text?: string; error?: string } {
  const { doc, error } = parseXmlDoc(input);
  if (!doc) return { ok: false, error };
  return {
    ok: true,
    text: input
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  };
}

/** Convert validated XML into a plain JSON structure. */
export function xmlToJson(input: string): { ok: boolean; value?: JsonValue; error?: string } {
  const { doc, error } = parseXmlDoc(input);
  if (!doc || !doc.documentElement) return { ok: false, error: error ?? 'Invalid XML' };

  const convert = (node: Element): JsonValue => {
    const result: { [key: string]: JsonValue } = {};
    for (const attr of Array.from(node.attributes)) result[`@${attr.name}`] = attr.value;
    const children = Array.from(node.children);
    if (!children.length) {
      const text = node.textContent?.trim() ?? '';
      if (!Object.keys(result).length) return text;
      if (text) result['#text'] = text;
      return result;
    }
    for (const child of children) {
      const value = convert(child);
      const existing = result[child.tagName];
      if (existing === undefined) result[child.tagName] = value;
      else if (Array.isArray(existing)) existing.push(value);
      else result[child.tagName] = [existing, value];
    }
    return result;
  };

  return { ok: true, value: { [doc.documentElement.tagName]: convert(doc.documentElement) } };
}

/* ------------------------------------------------------------------ HTML */

const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export type HtmlEncodeDepth = 'basic' | 'nonAscii' | 'all';

export function encodeHtml(input: string, depth: HtmlEncodeDepth = 'basic'): string {
  if (depth === 'all') {
    return [...input].map((c) => `&#${c.codePointAt(0)};`).join('');
  }
  return [...input]
    .map((c) => {
      if (HTML_ENTITIES[c]) return HTML_ENTITIES[c];
      if (depth === 'nonAscii' && c.codePointAt(0)! > 127) return `&#${c.codePointAt(0)};`;
      return c;
    })
    .join('');
}

export function decodeHtml(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_m, name: string) => {
      const map: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };
      return map[name] ?? _m;
    });
}

/* -------------------------------------------------------------------- URL */

export type UrlMode = 'component' | 'full' | 'base64url';

export function encodeUrl(input: string, mode: UrlMode): string {
  if (mode === 'component') return encodeURIComponent(input);
  if (mode === 'full') return encodeURI(input);
  return base64UrlEncode(input);
}

export function decodeUrl(input: string, mode: UrlMode): string {
  if (mode === 'base64url') return base64UrlDecode(input);
  return mode === 'component' ? decodeURIComponent(input) : decodeURI(input);
}

/* ----------------------------------------------------------------- Base64 */

export function utf8ToBase64(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function base64ToUtf8(input: string): string {
  const cleaned = input.replace(/\s+/g, '');
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function base64UrlEncode(input: string): string {
  return utf8ToBase64(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return base64ToUtf8(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '='));
}

export function isValidBase64(input: string): boolean {
  const cleaned = input.replace(/\s+/g, '');
  if (!cleaned || cleaned.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]*={0,2}$/.test(cleaned);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(input: string): Uint8Array {
  const cleaned = input.replace(/^data:[^;]*;base64,/, '').replace(/\s+/g, '');
  const binary = atob(cleaned);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** Extract the MIME type from a data URI, when present. */
export function mimeFromDataUri(input: string): string | null {
  const match = /^data:([^;,]+)[;,]/.exec(input.trim());
  return match ? match[1] : null;
}

/* ------------------------------------------------------------------ hash */

export type HashAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

export const HASH_ALGORITHMS: HashAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

export function hasWebCrypto(): boolean {
  return typeof crypto !== 'undefined' && typeof crypto.subtle?.digest === 'function';
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashBytes(data: BufferSource, algorithm: HashAlgorithm): Promise<string> {
  if (!hasWebCrypto()) throw new Error('noWebCrypto');
  return toHex(await crypto.subtle.digest(algorithm, data));
}

export async function hashText(text: string, algorithm: HashAlgorithm): Promise<string> {
  return hashBytes(new TextEncoder().encode(text), algorithm);
}

/* ------------------------------------------------------------ number base */

export interface BaseConversion {
  binary: string;
  octal: string;
  decimal: string;
  hexUpper: string;
  hexLower: string;
  bytes: string;
}

export function convertBase(input: string, fromBase: number): BaseConversion | null {
  const cleaned = input.trim().replace(/^0[bxo]/i, '').replace(/[\s_]/g, '');
  if (!cleaned) return null;
  const negative = cleaned.startsWith('-');
  const digits = negative ? cleaned.slice(1) : cleaned;
  const alphabet = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, fromBase);
  if (!digits.length) return null;
  let value = 0n;
  for (const char of digits.toLowerCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) return null;
    value = value * BigInt(fromBase) + BigInt(index);
  }
  if (negative) value = -value;

  const abs = value < 0n ? -value : value;
  const sign = value < 0n ? '-' : '';
  const binary = abs.toString(2);
  const padded = binary.padStart(Math.ceil(binary.length / 8) * 8, '0');
  const bytes = padded.match(/.{8}/g)?.join(' ') ?? padded;

  return {
    binary: sign + binary,
    octal: sign + abs.toString(8),
    decimal: value.toString(10),
    hexUpper: sign + abs.toString(16).toUpperCase(),
    hexLower: sign + abs.toString(16),
    bytes: sign + bytes,
  };
}

/** Convert to an arbitrary base 2–36. */
export function toBase(input: string, fromBase: number, toBaseValue: number): string | null {
  const parsed = convertBase(input, fromBase);
  if (!parsed) return null;
  return BigInt(parsed.decimal).toString(toBaseValue);
}
