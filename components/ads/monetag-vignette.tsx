'use client';

import * as React from 'react';

/**
 * Monetag Vignette Banner (loads immediately).
 *
 * Injects the official Monetag Vignette tag — the same self-injecting tag
 * Monetag gives you in the dashboard ("Get tag" -> Vignette Banner), which
 * creates a `<script>` element and sets `src` + `data-zone` on it.
 *
 * It loads as soon as the client page is hydrated, without waiting for cookie
 * consent (per site owner request). If you need to make this consent-gated
 * again, remove the comment below and remount it with <useConsent />.
 */
const MONETAG_VIGNETTE_SRC = 'https://n6wxm.com/vignette.min.js';
const DEFAULT_MONETAG_ZONE_ID = '11719435';
const VIGNETTE_SCRIPT_ID = 'monetag-vignette';

/**
 * A Monetag zone id is always a plain number. Validating it means a
 * mis-configured (or tampered) environment variable can never be used to
 * smuggle markup or an attribute break-out into the injected tag.
 */
function safeZoneId(value: string | undefined): string {
  return value && /^\d{1,15}$/.test(value) ? value : DEFAULT_MONETAG_ZONE_ID;
}

export function MonetagVignette() {
  const zoneId = safeZoneId(process.env.NEXT_PUBLIC_MONETAG_VIGNETTE_ZONE_ID);

  React.useEffect(() => {
    // Guard against double injection (React StrictMode / re-renders).
    if (document.getElementById(VIGNETTE_SCRIPT_ID)) return;

    // Create the script element before it is inserted, then synchronise the
    // data-zone attribute and the remote src exactly like the official tag.
    // `src` is a hard-coded constant — it is never built from user input or
    // from configuration — and the origin is pinned in the CSP script-src.
    const script = document.createElement('script');
    script.id = VIGNETTE_SCRIPT_ID;
    script.dataset.zone = zoneId;
    script.src = MONETAG_VIGNETTE_SRC;
    // Dynamically-inserted scripts load asynchronously by default, matching
    // the official Monetag tag.
    script.async = true;
    // Do not leak the exact tool page the visitor is on to the ad network.
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    document.body.appendChild(script);
  }, [zoneId]);

  return null;
}
