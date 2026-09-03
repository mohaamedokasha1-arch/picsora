/** UUID / ULID / Nano ID generation using only the browser's crypto API. */

export type IdKind = 'uuidv4' | 'uuidv1' | 'ulid' | 'nanoid';

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function uuidV4(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// UUID v1 state: a random node id + clock sequence, per RFC 4122 §4.5 (a random
// node is allowed when a MAC address is unavailable, which it always is here).
let clockSeq = randomBytes(2)[0] & 0x3f;
let lastTime = 0;
const nodeId = (() => {
  const bytes = randomBytes(6);
  bytes[0] |= 0x01; // set the multicast bit to mark a random node
  return bytes;
})();

export function uuidV1(): string {
  // 100-nanosecond intervals since 1582-10-15.
  const GREGORIAN_OFFSET = 122_192_928_000_000_000n;
  let now = Date.now();
  if (now <= lastTime) {
    clockSeq = (clockSeq + 1) & 0x3f;
    now = lastTime;
  }
  lastTime = now;
  const timestamp = BigInt(now) * 10_000n + GREGORIAN_OFFSET;

  const timeLow = Number(timestamp & 0xffffffffn);
  const timeMid = Number((timestamp >> 32n) & 0xffffn);
  const timeHigh = Number((timestamp >> 48n) & 0x0fffn) | 0x1000;
  const clockHigh = ((clockSeq >> 8) & 0x3f) | 0x80;
  const clockLow = clockSeq & 0xff;

  const pad = (value: number, size: number) => value.toString(16).padStart(size, '0');
  return [
    pad(timeLow >>> 0, 8),
    pad(timeMid, 4),
    pad(timeHigh, 4),
    pad(clockHigh, 2) + pad(clockLow, 2),
    hex(nodeId),
  ].join('-');
}

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

export function ulid(now = Date.now()): string {
  let time = '';
  let remaining = now;
  for (let i = 0; i < 10; i += 1) {
    time = ULID_ALPHABET[remaining % 32] + time;
    remaining = Math.floor(remaining / 32);
  }
  const bytes = randomBytes(16);
  let random = '';
  for (let i = 0; i < 16; i += 1) random += ULID_ALPHABET[bytes[i] % 32];
  return time + random;
}

export const NANOID_ALPHABET = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict';

export function nanoId(size = 21, alphabet = NANOID_ALPHABET): string {
  const bytes = randomBytes(size);
  let out = '';
  for (let i = 0; i < size; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export interface IdFormatOptions {
  hyphens: boolean;
  uppercase: boolean;
  braces: boolean;
}

export function formatId(value: string, options: IdFormatOptions): string {
  let out = options.hyphens ? value : value.replace(/-/g, '');
  out = options.uppercase ? out.toUpperCase() : out.toLowerCase();
  return options.braces ? `{${out}}` : out;
}

export interface UuidValidation {
  valid: boolean;
  version?: number;
  variant?: string;
  kind?: 'uuid' | 'ulid';
}

const UUID_RE = /^\{?([0-9a-f]{8})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{4})-?([0-9a-f]{12})\}?$/i;

export function validateUuid(input: string): UuidValidation {
  const value = input.trim();
  const match = UUID_RE.exec(value);
  if (match) {
    const version = parseInt(match[3][0], 16);
    const variantNibble = parseInt(match[4][0], 16);
    let variant = 'reserved';
    if (variantNibble >= 8 && variantNibble <= 11) variant = 'RFC 4122';
    else if (variantNibble < 8) variant = 'NCS';
    else if (variantNibble >= 12 && variantNibble <= 13) variant = 'Microsoft';
    return { valid: version >= 1 && version <= 8, version, variant, kind: 'uuid' };
  }
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(value)) return { valid: true, kind: 'ulid' };
  return { valid: false };
}

export function generateIds(kind: IdKind, count: number, nanoSize = 21, alphabet = NANOID_ALPHABET): string[] {
  const total = Math.max(1, Math.min(1000, Math.floor(count)));
  const out: string[] = [];
  for (let i = 0; i < total; i += 1) {
    if (kind === 'uuidv4') out.push(uuidV4());
    else if (kind === 'uuidv1') out.push(uuidV1());
    else if (kind === 'ulid') out.push(ulid());
    else out.push(nanoId(nanoSize, alphabet));
  }
  return out;
}
