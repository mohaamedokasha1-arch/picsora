export interface ConsentState {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  advertising: boolean;
}

export const CONSENT_COOKIE = 'consent_preferences';

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
    const value = decodeURIComponent(match.split('=').slice(1).join('='));
    const parsed = JSON.parse(value) as Partial<ConsentState>;
    return {
      necessary: true,
      functional: Boolean(parsed.functional),
      analytics: Boolean(parsed.analytics),
      advertising: Boolean(parsed.advertising),
    };
  } catch {
    return null;
  }
}

export function writeConsentCookie(state: ConsentState) {
  if (typeof document === 'undefined') return;
  const value = encodeURIComponent(JSON.stringify(state));
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `${CONSENT_COOKIE}=${value}; expires=${expires}; path=/; SameSite=Lax`;
}

export function hasConsented(): boolean {
  return readConsentCookie() !== null;
}
