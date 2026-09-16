'use client';

import * as React from 'react';
import { useConsent } from '@/components/consent/consent-provider';
import { siteConfig } from '@/lib/site';

const ADSENSE_SCRIPT_MARKER = 'data-piclizer-adsense';
const PUBLISHER_ID_PATTERN = /^ca-pub-\d{10,20}$/;

/**
 * Loads Google's library exactly once, in document.head, after advertising
 * consent. Keeping this client-side avoids an SSR/hydration mismatch and
 * ensures Google cannot set advertising cookies before the visitor opts in.
 */
export function AdsenseScript() {
  const { consent } = useConsent();
  const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';
  const configuredClientId = process.env.NEXT_PUBLIC_ADS_CLIENT_ID || siteConfig.adsensePublisherId;
  const clientId = PUBLISHER_ID_PATTERN.test(configuredClientId) ? configuredClientId : undefined;

  React.useEffect(() => {
    if (!adsEnabled || !consent?.advertising || !clientId) return;

    // React layouts can mount more than once during development. The marker
    // makes the one-script guarantee explicit instead of relying on React's
    // current mounting behaviour.
    if (document.head.querySelector(`script[${ADSENSE_SCRIPT_MARKER}]`)) return;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`;
    script.crossOrigin = 'anonymous';
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    script.setAttribute(ADSENSE_SCRIPT_MARKER, 'true');
    document.head.appendChild(script);
  }, [adsEnabled, clientId, consent?.advertising]);

  return null;
}
