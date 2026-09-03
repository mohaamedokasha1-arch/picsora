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

export function MonetagVignette() {
  const zoneId =
    process.env.NEXT_PUBLIC_MONETAG_VIGNETTE_ZONE_ID || DEFAULT_MONETAG_ZONE_ID;

  React.useEffect(() => {
    // Guard against double injection (React StrictMode / re-renders).
    if (document.getElementById(VIGNETTE_SCRIPT_ID)) return;

    // Create the script element before it is inserted, then synchronise the
    // data-zone attribute and the remote src exactly like the official tag.
    const script = document.createElement('script');
    script.id = VIGNETTE_SCRIPT_ID;
    script.dataset.zone = zoneId;
    script.src = MONETAG_VIGNETTE_SRC;
    // Dynamically-inserted scripts load asynchronously by default, matching
    // the official Monetag tag.
    document.body.appendChild(script);
  }, [zoneId]);

  return null;
}
