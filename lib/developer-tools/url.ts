/**
 * URL anatomy for the URL Parser tool — protocol, credentials, host, port,
 * path, query parameters and hash. Uses the platform URL parser, so the
 * result matches exactly what a browser would request.
 */

export interface UrlQueryParam {
  key: string;
  value: string;
}

export interface ParsedUrl {
  /** Original input as typed. */
  input: string;
  protocol: string;
  username: string;
  password: string;
  host: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
  origin: string;
  params: UrlQueryParam[];
  /** True when "https://" had to be assumed for a bare domain. */
  assumedProtocol: boolean;
}

export type UrlParseResult = { ok: true; value: ParsedUrl } | { ok: false; error: 'invalidUrl' };

const BARE_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?([/?#].*)?$/i;

export function parseUrlParts(input: string, decode = true): UrlParseResult {
  const value = input.trim();
  if (!value) return { ok: false, error: 'invalidUrl' };

  let candidate = value;
  let assumedProtocol = false;
  // "example.com/a?b=1" has no scheme — assume https rather than failing.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value) && BARE_HOST.test(value)) {
    candidate = `https://${value}`;
    assumedProtocol = true;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, error: 'invalidUrl' };
  }

  // `forEach` collapses repeated keys into one comma-joined value, so walk the
  // pairs instead — "?tag=a&tag=b" must stay two parameters.
  const params: UrlQueryParam[] = [];
  for (const [key, paramValue] of url.searchParams.entries()) {
    params.push({ key, value: paramValue });
  }

  return {
    ok: true,
    value: {
      input: value,
      protocol: url.protocol.replace(/:$/, ''),
      username: url.username,
      password: url.password,
      host: url.host,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? '443' : url.protocol === 'http:' ? '80' : ''),
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      origin: url.origin,
      params,
      assumedProtocol,
    },
  };
}

/** Query string → flat JSON object (repeated keys become arrays). */
export function queryToJson(params: UrlQueryParam[]): string {
  const out: Record<string, string | string[]> = {};
  for (const { key, value } of params) {
    const existing = out[key];
    if (existing === undefined) out[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else out[key] = [existing, value];
  }
  return JSON.stringify(out, null, 2);
}

/** A plain "key: value" report, used by the copy button. */
export function urlReport(parsed: ParsedUrl): string {
  const lines = [
    `protocol: ${parsed.protocol}`,
    `origin: ${parsed.origin}`,
    `host: ${parsed.host}`,
    `hostname: ${parsed.hostname}`,
    `port: ${parsed.port}`,
    `path: ${parsed.pathname}`,
    `query: ${parsed.search}`,
    `hash: ${parsed.hash}`,
  ];
  if (parsed.username) lines.push(`username: ${parsed.username}`);
  if (parsed.password) lines.push(`password: ${'•'.repeat(parsed.password.length)}`);
  for (const { key, value } of parsed.params) lines.push(`param ${key} = ${value}`);
  return lines.join('\n');
}
