/**
 * Password / PIN generation with the platform CSPRNG (crypto.getRandomValues).
 * Nothing leaves the device; entropy is reported honestly per password.
 */

export interface PasswordOptions {
  length: number; // 4..128
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  /** Drop ambiguous glyphs (0/O, 1/l/I, …). */
  excludeAmbiguous: boolean;
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const UPPER_AMBIGUOUS = 'IO';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const LOWER_AMBIGUOUS = 'l';
const DIGITS = '23456789';
const DIGITS_AMBIGUOUS = '01';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~';

function randomIndex(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Rejection sampling — modulo bias would be tiny but this is free.
  const limit = Math.floor(0x100000000 / max) * max;
  let value = array[0];
  while (value >= limit) {
    crypto.getRandomValues(array);
    value = array[0];
  }
  // eslint-disable-next-line no-bitwise
  return value % max;
}

/** Build the active alphabet for the given options ('' when all are off). */
export function passwordAlphabet(options: PasswordOptions): string {
  let out = '';
  if (options.upper) out += options.excludeAmbiguous ? UPPER : UPPER + UPPER_AMBIGUOUS;
  if (options.lower) out += options.excludeAmbiguous ? LOWER : LOWER + LOWER_AMBIGUOUS;
  if (options.digits) out += options.excludeAmbiguous ? DIGITS : DIGITS + DIGITS_AMBIGUOUS;
  if (options.symbols) out += SYMBOLS;
  return out;
}

export interface GeneratedPassword {
  value: string;
  /** Shannon entropy in bits (length × log2(alphabet)). */
  entropy: number;
}

/** Generate one password. Throws when no character set is selected. */
export function generatePassword(options: PasswordOptions): GeneratedPassword {
  const alphabet = passwordAlphabet(options);
  if (!alphabet) throw new Error('password-no-charset');
  const length = Math.max(4, Math.min(128, Math.round(options.length) || 16));
  // Guarantee at least one character from every enabled set.
  const sets: string[] = [];
  if (options.upper) sets.push(options.excludeAmbiguous ? UPPER : UPPER + UPPER_AMBIGUOUS);
  if (options.lower) sets.push(options.excludeAmbiguous ? LOWER : LOWER + LOWER_AMBIGUOUS);
  if (options.digits) sets.push(options.excludeAmbiguous ? DIGITS : DIGITS + DIGITS_AMBIGUOUS);
  if (options.symbols) sets.push(SYMBOLS);
  const chars: string[] = sets.map((set) => set[randomIndex(set.length)]);
  while (chars.length < length) chars.push(alphabet[randomIndex(alphabet.length)]);
  // Fisher–Yates shuffle so the guaranteed chars aren't always first.
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const entropy = length * Math.log2(alphabet.length);
  return { value: chars.join(''), entropy };
}

/** Generate a numeric PIN of `digits` length (4–12). */
export function generatePin(digits: number): string {
  const n = Math.max(4, Math.min(12, Math.round(digits) || 6));
  let out = '';
  for (let i = 0; i < n; i += 1) out += String(randomIndex(10));
  return out;
}

/** Strength bucket from entropy bits (NIST-style rough bands). */
export function strengthOf(entropy: number): 'weak' | 'fair' | 'strong' | 'excellent' {
  if (entropy < 40) return 'weak';
  if (entropy < 60) return 'fair';
  if (entropy < 90) return 'strong';
  return 'excellent';
}
