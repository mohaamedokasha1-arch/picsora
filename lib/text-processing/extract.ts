/**
 * Pull structured items out of free text for the Text Extractor tool:
 * URLs, e-mail addresses, phone numbers and numbers — all offline.
 */

export type ExtractKind = 'urls' | 'emails' | 'phones' | 'numbers';

export const EXTRACT_KINDS: ExtractKind[] = ['urls', 'emails', 'phones', 'numbers'];

export interface ExtractOptions {
  kinds: Record<ExtractKind, boolean>;
  /** Keep only the first occurrence of each item. */
  unique?: boolean;
}

export interface ExtractGroup {
  kind: ExtractKind;
  items: string[];
}

export interface ExtractResult {
  groups: ExtractGroup[];
  total: number;
  characters: number;
}

/** Trailing punctuation is sentence noise, not part of the item. */
function trimTrailing(value: string): string {
  return value.replace(/[.,;:!?)\]}>'"»”]+$/u, '');
}

const URL_RE = /\b(?:https?:\/\/|ftp:\/\/|www\.)[^\s<>"'`{}|\\^[\]]+/giu;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
/** International or local phone shapes; digits are validated afterwards. */
const PHONE_RE =
  /(?:\+|00)\d[\d\s().-]{5,18}\d|\(?\b\d{2,4}\)?[\s.-]\d{2,4}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4})?/g;
const NUMBER_RE = /-?\d+(?:[.,]\d+)?/g;

function digitsCount(value: string): number {
  return (value.match(/\d/g) ?? []).length;
}

export function extractUrls(input: string): string[] {
  return (input.match(URL_RE) ?? []).map(trimTrailing).filter((url) => url.length > 3);
}

export function extractEmails(input: string): string[] {
  return (input.match(EMAIL_RE) ?? []).map(trimTrailing);
}

export function extractPhones(input: string): string[] {
  const found = input.match(PHONE_RE) ?? [];
  return found
    .map((phone) => phone.trim())
    .filter((phone) => {
      const digits = digitsCount(phone);
      // A phone number has 7–15 digits; "2024" or "12.5" is not one.
      if (digits < 7 || digits > 15) return false;
      // Require a phone-ish separator or a country prefix unless it is a long
      // unbroken run of digits (e.g. 0501234567).
      const hasSeparator = /[+\s().-]/.test(phone);
      return hasSeparator || digits >= 9;
    });
}

export function extractNumbers(input: string): string[] {
  return input.match(NUMBER_RE) ?? [];
}

/** Blank out already-extracted items so their digits are not counted twice. */
function mask(input: string, items: string[]): string {
  let out = input;
  for (const item of items) {
    if (!item) continue;
    out = out.split(item).join(' '.repeat(item.length));
  }
  return out;
}

/**
 * Run the enabled extractors over the text. Numbers are extracted last and
 * with URLs / emails / phones blanked out, so "https://a.com/2" reports the
 * URL and not a stray "2".
 */
export function extractItems(input: string, options: ExtractOptions): ExtractResult {
  const { kinds, unique = false } = options;
  const groups: ExtractGroup[] = [];
  let total = 0;
  let characters = 0;
  const extracted: string[] = [];

  for (const kind of EXTRACT_KINDS) {
    if (!kinds[kind]) continue;
    const source = kind === 'numbers' ? mask(input, extracted) : input;
    let items =
      kind === 'urls'
        ? extractUrls(source)
        : kind === 'emails'
          ? extractEmails(source)
          : kind === 'phones'
            ? extractPhones(source)
            : extractNumbers(source);

    items = items.map((item) => item.trim()).filter(Boolean);

    if (unique) {
      const seen = new Set<string>();
      items = items.filter((item) => {
        const key = kind === 'emails' || kind === 'urls' ? item.toLowerCase() : item;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    extracted.push(...items);
    groups.push({ kind, items });
    total += items.length;
    characters += items.join('').length;
  }

  return { groups, total, characters };
}
