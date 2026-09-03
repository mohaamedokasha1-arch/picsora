'use client';

import * as React from 'react';
import { useConsent } from '@/components/consent/consent-provider';

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
 * Consent-gated analytics.
 * Scripts are loaded only after the user consents to analytics cookies.
 * No analytics provider is active by default (NEXT_PUBLIC_ANALYTICS_ENABLED=false).
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useConsent();

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
    return () => {
      /* scripts stay for the session once consented */
    };
  }, [consent?.analytics]);

  const trackEvent = React.useCallback((eventName: string, properties?: Record<string, unknown>) => {
    if (!consent?.analytics) return;
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', eventName, properties ?? {});
    }
  }, [consent?.analytics]);

  return <AnalyticsContext.Provider value={{ trackEvent }}>{children}</AnalyticsContext.Provider>;
}
