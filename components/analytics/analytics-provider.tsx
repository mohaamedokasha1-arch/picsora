'use client';

import * as React from 'react';
import { useConsent } from '@/components/consent/consent-provider';
import { trackEvent as trackLocalEvent, type AnalyticsEventType, type AnalyticsEventData } from '@/lib/analytics';

interface AnalyticsContextValue {
  trackEvent: (eventName: string, properties?: Record<string, unknown>) => void;
}

const AnalyticsContext = React.createContext<AnalyticsContextValue>({
  trackEvent: () => undefined,
});

export function useAnalytics() {
  return React.useContext(AnalyticsContext);
}

/**
 * Consent-gated analytics + PWA Service Worker registrar.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useConsent();

  // Register PWA Service Worker
  React.useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          /* Service worker registration silently ignored in dev/unsupported */
        });
    }
  }, []);

  React.useEffect(() => {
    if (!consent?.analytics) return;
    if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'true') return;

    const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
    if (gaId) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);
      const w = window as unknown as {
        dataLayer: unknown[];
        gtag: (...args: unknown[]) => void;
      };
      w.dataLayer = w.dataLayer || [];
      w.gtag = function gtag(...args: unknown[]) {
        w.dataLayer.push(args);
      };
      window.gtag = w.gtag;
      w.gtag('js', new Date());
      w.gtag('config', gaId, { anonymize_ip: true });
    }
  }, [consent?.analytics]);

  const trackEvent = React.useCallback((eventName: string, properties?: Record<string, unknown>) => {
    trackLocalEvent(eventName as AnalyticsEventType, properties as AnalyticsEventData);
    if (!consent?.analytics) return;
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, properties ?? {});
    }
  }, [consent?.analytics]);

  return <AnalyticsContext.Provider value={{ trackEvent }}>{children}</AnalyticsContext.Provider>;
}
