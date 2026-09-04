/**
 * Hardened `fetch` wrapper for the two places the app talks to the network.
 *
 * Adds, for every outbound request:
 *  - an abort timeout (no hanging request can pin a tab),
 *  - `credentials: 'omit'` so no cookie is ever sent to a third party,
 *  - `referrerPolicy: 'no-referrer'` so the visited tool URL is not leaked,
 *  - `redirect: 'error'` so a compromised endpoint cannot bounce the request
 *    to an unexpected host,
 *  - a response-size ceiling before the body is parsed as JSON.
 */

import { isSafeHttpUrl, safeJsonParse } from './sanitize';

export interface SafeFetchOptions {
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Record<string, string>;
  /** Abort after this many milliseconds. */
  timeoutMs?: number;
  /** Reject bodies larger than this (bytes) before parsing. */
  maxBytes?: number;
  signal?: AbortSignal;
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

export async function safeFetch(url: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { method = 'GET', body, headers, timeoutMs = 15000, signal } = options;

  if (!isSafeHttpUrl(url)) throw new NetworkError('unsafe-endpoint');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, {
      method,
      body,
      headers,
      cache: 'no-store',
      credentials: 'omit',
      mode: 'cors',
      redirect: 'error',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * `safeFetch` + size-capped, prototype-pollution-proof JSON parsing.
 */
export async function safeFetchJson<T = unknown>(
  url: string,
  options: SafeFetchOptions = {},
): Promise<T> {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const response = await safeFetch(url, options);
  if (!response.ok) throw new NetworkError(`bad-status-${response.status}`);

  const declared = Number(response.headers.get('content-length') ?? '0');
  if (declared && declared > maxBytes) throw new NetworkError('response-too-large');

  const text = await response.text();
  if (text.length > maxBytes) throw new NetworkError('response-too-large');

  const parsed = safeJsonParse<T>(text, maxBytes);
  if (parsed === null) throw new NetworkError('bad-payload');
  return parsed;
}
