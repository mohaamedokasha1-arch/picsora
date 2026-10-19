'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useConsent } from '@/components/consent/consent-provider';
import { cn } from '@/lib/utils';

export interface AdsterraNativeProps {
  className?: string;
}

// Adsterra Native Banner unit. Both ids below are the public placement ids
// from the tag the network hands out — the container id is fixed by Adsterra
// (their invoke.js looks for `#container-<id>`), so it must match exactly.
const NATIVE_UNIT_ID = 'd965580233cbc5a77f6b8faca257671c';
const NATIVE_CONTAINER_ID = `container-${NATIVE_UNIT_ID}`;
const NATIVE_SCRIPT_ID = 'adsterra-native';
// Hard-coded serving URL — never built from user input — and pinned in the
// CSP script/connect allow-lists.
const NATIVE_SRC = `https://furydonkeypharmacy.com/${NATIVE_UNIT_ID}/invoke.js`;

/**
 * Adsterra Native Banner.
 *
 * Unlike the 300×250 banner, the native unit fills a named container
 * (`#container-<id>`) with its own markup and grows to its natural height,
 * so it is injected as a real element and the official script is appended
 * once the container is on the page (same pattern as the Monetag tag).
 *
 * Renders the real ad only when the visitor consented to advertising cookies
 * (and `NEXT_PUBLIC_ADSTERRA_ENABLED` is not explicitly `false`). Used at
 * the very bottom of the homepage, below all editorial content.
 */
export function AdsterraNative({ className }: AdsterraNativeProps) {
  const t = useTranslations('common');
  const { consent } = useConsent();
  // Opt-out kill switch — see adsterra-banner.tsx.
  const enabled = process.env.NEXT_PUBLIC_ADSTERRA_ENABLED !== 'false';
  const showAd = enabled && Boolean(consent?.advertising);

  React.useEffect(() => {
    if (!showAd) return;

    // Guard against double injection (React StrictMode / re-renders).
    if (document.getElementById(NATIVE_SCRIPT_ID)) return;

    // Load the official Adsterra tag exactly as published: async, and the
    // data-cfasync="false" marker Cloudflare Rocket Loader honours. The
    // script finds `#container-<id>` (already rendered below) and fills it.
    const script = document.createElement('script');
    script.id = NATIVE_SCRIPT_ID;
    script.async = true;
    script.dataset.cfasync = 'false';
    script.src = NATIVE_SRC;
    // Do not leak the exact page the visitor is on to the ad network.
    script.referrerPolicy = 'strict-origin-when-cross-origin';
    document.body.appendChild(script);

    return () => {
      // Remove the tag and empty the slot on unmount so a later remount
      // (client-side navigation back to the homepage) injects a fresh tag
      // that fills the fresh container instead of leaving it blank.
      script.remove();
      const container = document.getElementById(NATIVE_CONTAINER_ID);
      if (container) container.replaceChildren();
    };
  }, [showAd]);

  return (
    <div
      data-ad="adsterra-native"
      aria-hidden={!showAd ? 'true' : undefined}
      className={cn('w-full overflow-hidden', className)}
    >
      {showAd ? <div id={NATIVE_CONTAINER_ID} aria-label={t('adLabel')} role="complementary" /> : null}
    </div>
  );
}
