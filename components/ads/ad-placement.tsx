'use client';

import * as React from 'react';
import { useConsent } from '@/components/consent/consent-provider';
import { cn } from '@/lib/utils';

export interface AdPlacementProps {
  slot: string;
  className?: string;
  minHeight?: string;
}

/**
 * Reserved ad container. Renders real ad code only when
 * NEXT_PUBLIC_ADS_ENABLED=true AND the user consented to advertising cookies.
 * Otherwise it reserves space (prevents layout shift) but shows nothing.
 */
export function AdPlacement({ slot, className, minHeight = '90px' }: AdPlacementProps) {
  const { consent } = useConsent();
  const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === 'true';
  const clientId = process.env.NEXT_PUBLIC_ADS_CLIENT_ID;

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
      data-ad-slot={slot}
      aria-hidden={!showAd ? 'true' : undefined}
      className={cn('flex w-full items-center justify-center overflow-hidden', className)}
      style={{ minHeight }}
    >
      {showAd ? (
        <ins
          className="adsbygoogle block"
          style={{ display: 'block', minHeight }}
          data-ad-client={clientId}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : null}
    </div>
  );
}
