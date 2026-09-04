/**
 * Pure, local JWT utilities. Decoding is just base64url + JSON — no network,
 * no libraries. HS256 verification uses the browser's Web Crypto API.
 */

export const MAX_JWT_LENGTH = 20000;

export interface JwtDecoded {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  headerB64: string;
  payloadB64: string;
  signingInput: string;
  algorithm: string;
}

export class JwtError extends Error {
  constructor(message = 'jwtInvalid') {
    super(message);
    this.name = 'JwtError';
  }
}

function base64UrlToBytes(input: string): Uint8Array {
  let s = input.trim().replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 1) throw new JwtError();
  if (pad) s += '='.repeat(4 - pad);
  if (!/^[A-Za-z0-9+/=]*$/.test(s)) throw new JwtError();
  const binary = atob(s);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

function parsePart(b64: string): Record<string, unknown> {
  const bytes = base64UrlToBytes(b64);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new JwtError();
  }
  try {
    const value = JSON.parse(text) as unknown;
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new JwtError();
    return value as Record<string, unknown>;
  } catch (error) {
    if (error instanceof JwtError) throw error;
    throw new JwtError();
  }
}

/** Decode a compact JWT/JWS without verifying. Throws JwtError. */
export function decodeJwt(token: string): JwtDecoded {
  const cleaned = token.trim().replace(/[\s]+/g, '');
  if (!cleaned || cleaned.length > MAX_JWT_LENGTH) throw new JwtError();
  const parts = cleaned.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new JwtError();
  const [headerB64, payloadB64, signature] = parts;
  if (!/^[A-Za-z0-9-_]+$/.test(signature)) throw new JwtError();
  const header = parsePart(headerB64);
  const payload = parsePart(payloadB64);
  const algorithm = typeof header.alg === 'string' ? header.alg : 'none';
  return {
    header,
    payload,
    signature,
    headerB64,
    payloadB64,
    signingInput: `${headerB64}.${payloadB64}`,
    algorithm,
  };
}

/** Verify an HS256/HS384/HS512 signature locally with Web Crypto. */
export async function verifyHmac(decoded: JwtDecoded, secret: string): Promise<boolean> {
  const alg = decoded.algorithm.toUpperCase();
  const hashName = alg === 'HS384' ? 'SHA-384' : alg === 'HS512' ? 'SHA-512' : 'SHA-256';
  if (alg !== 'HS256' && alg !== 'HS384' && alg !== 'HS512') {
    throw new JwtError('jwtUnsupportedAlg');
  }
  if (!secret) throw new JwtError('jwtNeedSecret');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: hashName },
    false,
    ['sign', 'verify'],
  );
  const data = new TextEncoder().encode(decoded.signingInput);
  const sigBytes = base64UrlToBytes(decoded.signature);
  // ArrayBuffer copy — subtle.verify needs a clean ArrayBuffer view.
  const sig = sigBytes.slice().buffer as ArrayBuffer;
  try {
    return await crypto.subtle.verify('HMAC', key, sig, data);
  } catch {
    return false;
  }
}

export interface JwtTimeInfo {
  issuedAt: number | null;
  expiresAt: number | null;
  notBefore: number | null;
  expired: boolean | null;
}

export function jwtTimes(payload: Record<string, unknown>): JwtTimeInfo {
  const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const iat = num(payload.iat);
  const exp = num(payload.exp);
  const nbf = num(payload.nbf);
  const now = Math.floor(Date.now() / 1000);
  return {
    issuedAt: iat,
    expiresAt: exp,
    notBefore: nbf,
    expired: exp === null ? null : exp < now,
  };
}

export function formatUnix(ts: number | null): string {
  if (ts === null) return '—';
  try {
    return new Date(ts * 1000).toLocaleString();
  } catch {
    return String(ts);
  }
}
