'use client';

import * as React from 'react';
import { useConsent } from '@/components/consent/consent-provider';

const MONETAG_TAG_SRC = 'https://inklinkor.com/tag.min.js';
const VIGNETTE_SCRIPT_ID = 'monetag-vignette';

/**
 * Monetag Vignette Banner (consent-gated).
 *
 * Injects Monetag's official Vignette tag into <head> — exactly where Monetag
 * instructs ("between <head> and </head>") — but only when:
 *   1. NEXT_PUBLIC_MONETAG_VIGNETTE_ZONE_ID is configured, and
 *   2. the user has consented to advertising cookies.
 *
 * This mirrors the consent behaviour of the rest of the ad system
 * (see <AdPlacement />): no advertising scripts load until consent is given.
 */
export function MonetagVignette() {
  const { consent } = useConsent();
  const zoneId = process.env.NEXT_PUBLIC_MONETAG_VIGNETTE_ZONE_ID;

  React.useEffect(() => {
    if (!zoneId || !consent?.advertising) return;

    // Guard against double injection (React StrictMode / re-renders).
    if (document.getElementById(VIGNETTE_SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = VIGNETTE_SCRIPT_ID;
    // Official Monetag Vignette tag. It appends tag.min.js to the document
    // and reads the numeric zone id from the data-zone attribute.
    script.textContent = `(function(s,u,z,p){s.src=u,s.setAttribute('data-zone',z),p.appendChild(s);})(document.createElement('script'),'${MONETAG_TAG_SRC}','${zoneId}',document.body||document.documentElement);`;
    document.head.appendChild(script);
  }, [zoneId, consent?.advertising]);

  return null;
}
