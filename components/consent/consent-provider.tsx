'use client';

import * as React from 'react';
import {
  readConsentCookie,
  writeConsentCookie,
  type ConsentState,
} from '@/lib/consent';

interface ConsentContextValue {
  consent: ConsentState | null;
  /** Whether the user has made a choice (banner can hide). */
  decided: boolean;
  showManager: boolean;
  openManager: () => void;
  closeManager: () => void;
  acceptAll: () => void;
  rejectAll: () => void;
  savePreferences: (state: ConsentState) => void;
}

const ConsentContext = React.createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const ctx = React.useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider');
  return ctx;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = React.useState<ConsentState | null>(null);
  const [showManager, setShowManager] = React.useState(false);

  // Hydrate from cookie after mount (avoids SSR mismatch).
  React.useEffect(() => {
    setConsent(readConsentCookie());
  }, []);

  const acceptAll = React.useCallback(() => {
    const state: ConsentState = { necessary: true, functional: true, analytics: true, advertising: true };
    writeConsentCookie(state);
    setConsent(state);
    setShowManager(false);
  }, []);

  const rejectAll = React.useCallback(() => {
    const state: ConsentState = { necessary: true, functional: false, analytics: false, advertising: false };
    writeConsentCookie(state);
    setConsent(state);
    setShowManager(false);
  }, []);

  const savePreferences = React.useCallback((state: ConsentState) => {
    const normalized: ConsentState = { ...state, necessary: true };
    writeConsentCookie(normalized);
    setConsent(normalized);
    setShowManager(false);
  }, []);

  const value: ConsentContextValue = {
    consent,
    decided: consent !== null,
    showManager,
    openManager: () => setShowManager(true),
    closeManager: () => setShowManager(false),
    acceptAll,
    rejectAll,
    savePreferences,
  };

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
