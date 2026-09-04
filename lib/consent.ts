import { safeJsonParse } from '@/lib/security/sanitize';

export interface ConsentState {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  advertising: boolean;
}

export const CONSENT_COOKIE = 'consent_preferences';

/** A well-formed consent cookie is tiny; anything larger is not ours. */
const MAX_COOKIE_VALUE_LENGTH = 512;

export const DEFAULT_CONSENT: ConsentState = {
  necessary: true,
  functional: false,
  analytics: false,
  advertising: false,
};

export function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${CONSENT_COOKIE}=`));
  if (!match) return null;
  try {
    const rawValue = match.split('=').slice(1).join('=');
    if (rawValue.length > MAX_COOKIE_VALUE_LENGTH) return null;
    // Cookies are attacker-controllable (a sibling subdomain, an XSS, or the
    // user's own devtools), so the value is parsed defensively: prototype
    // keys are dropped and every field is coerced to a strict boolean.
    const parsed = safeJsonParse<Partial<ConsentState>>(
      decodeURIComponent(rawValue),
      MAX_COOKIE_VALUE_LENGTH,
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return {
      necessary: true,
      functional: parsed.functional === true,
      analytics: parsed.analytics === true,
      advertising: parsed.advertising === true,
    };
  } catch {
    return null;
  }
}

export function writeConsentCookie(state: ConsentState) {
  if (typeof document === 'undefined') return;
  // Only the known flags are persisted — never a caller-supplied object.
  const value = encodeURIComponent(
    JSON.stringify({
      necessary: true,
      functional: state.functional === true,
      analytics: state.analytics === true,
      advertising: state.advertising === true,
    }),
  );
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  // `Secure` whenever the page is served over HTTPS (kept off on plain-HTTP
  // localhost so the dev server still works). `SameSite=Lax` blocks the cookie
  // on cross-site POSTs/iframes, which is the CSRF-relevant case here.
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_COOKIE}=${value}; expires=${expires}; path=/; SameSite=Lax${secure}`;
}

export function hasConsented(): boolean {
  return readConsentCookie() !== null;
}
