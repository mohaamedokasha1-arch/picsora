'use client';

import * as React from 'react';
import { useConsent } from '@/components/consent/consent-provider';
import { cn } from '@/lib/utils';

export interface AdPlacementProps {
  /** Google AdSense ad-unit slot id. */
  slot: string;
  className?: string;
  minHeight?: string;
}

// The ad unit supplied for this site. A numeric slot is required by AdSense;
// legacy placement names fall back to this value so they cannot produce a
// misleading, non-working <ins> element.
const DEFAULT_AD_SLOT = '3492160006';

/**
 * Reserved ad container. Renders real ad code only when
 * NEXT_PUBLIC_ADS_ENABLED=true AND the user consented to advertising cookies.
 * Otherwise it reserves space (prevents layout shift) but shows nothing.
 */
export function AdPlacement({ slot, className, minHeight = '90px' }: AdPlacementProps) {
  const { consent } = useConsent();
  const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';
  const rawClientId = process.env.NEXT_PUBLIC_ADS_CLIENT_ID || 'ca-pub-5770911159315916';
  // AdSense publisher ids look like `ca-pub-1234567890123456`. Validating the
  // configured value keeps a tampered environment variable out of the DOM.
  const clientId = /^ca-pub-\d{10,20}$/.test(rawClientId) ? rawClientId : undefined;
  // Slot ids are numeric; the value is only ever rendered as an attribute, but
  // constraining it removes any attribute-injection surface entirely.
  const safeSlot = /^\d{1,32}$/.test(slot) ? slot : DEFAULT_AD_SLOT;

  React.useEffect(() => {
    if (!adsEnabled || !consent?.advertising || !clientId) return;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle!.push({});
    } catch {
      /* no-op */
    }
  }, [adsEnabled, consent?.advertising, clientId]);

  const showAd = adsEnabled && consent?.advertising && clientId;

  return (
    <div
      data-ad-slot={safeSlot}
      aria-hidden={!showAd ? 'true' : undefined}
      className={cn('flex w-full items-center justify-center overflow-hidden', className)}
      style={{ minHeight }}
    >
      {showAd ? (
        <ins
          className="adsbygoogle block"
          style={{ display: 'block', minHeight }}
          data-ad-client={clientId}
          data-ad-slot={safeSlot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : null}
    </div>
  );
}
