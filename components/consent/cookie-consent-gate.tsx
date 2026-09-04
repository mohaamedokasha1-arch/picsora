'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Cookie } from 'lucide-react';
import { readConsentCookie } from '@/lib/consent';
import { useConsent } from './consent-provider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Phase = 'pending' | 'open' | 'leaving' | 'closed';

/**
 * Cookie consent gate — a FULL-SCREEN overlay shown on first visit.
 *
 * The visitor cannot use the site until they choose Accept or Reject:
 *
 * - The overlay covers the whole viewport above everything else.
 * - While it is open the app behind it is inert (`inert`) and body scrolling
 *   is locked, so nothing on the page can be clicked, scrolled or focused.
 * - Accept / Reject persists the choice in a cookie, so the gate closes for
 *   good — it won't come back during the session (or on later visits).
 *
 * The gate is rendered outside `#app-root` so it is never affected by the
 * `inert` state it applies to the site.
 */
export function CookieConsentGate() {
  const t = useTranslations('consent');
  const { acceptAll, rejectAll } = useConsent();
  const [phase, setPhase] = React.useState<Phase>('pending');
  const acceptRef = React.useRef<HTMLButtonElement>(null);
  const timerRef = React.useRef<number | undefined>(undefined);

  // Reveal the gate right after the first paint, unless the visitor already
  // made a choice on a previous visit (stored consent cookie).
  React.useEffect(() => {
    if (readConsentCookie() !== null) {
      setPhase('closed');
      return;
    }
    const id = window.requestAnimationFrame(() => setPhase('open'));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // While the gate is open/leaving: lock scrolling and make the site behind
  // it inert so it cannot be interacted with until a choice is made.
  React.useEffect(() => {
    if (phase === 'pending' || phase === 'closed') return;
    const appRoot = document.getElementById('app-root');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (appRoot) appRoot.inert = true;
    let focusId: number | undefined;
    if (phase === 'open') {
      focusId = window.setTimeout(() => acceptRef.current?.focus(), 80);
    }
    return () => {
      document.body.style.overflow = previousOverflow;
      if (appRoot) appRoot.inert = false;
      if (focusId !== undefined) window.clearTimeout(focusId);
    };
  }, [phase]);

  const choose = (apply: () => void) => {
    if (phase !== 'open') return;
    setPhase('leaving');
    // Small fade-out, then persist the choice for good.
    timerRef.current = window.setTimeout(() => {
      apply();
      setPhase('closed');
    }, 200);
  };

  if (phase === 'pending' || phase === 'closed') return null;

  const open = phase === 'open';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      aria-hidden={open ? undefined : true}
      className={cn(
        'fixed inset-0 z-[80] overflow-y-auto bg-background/70 backdrop-blur-sm transition-opacity duration-200 supports-[backdrop-filter]:bg-background/60',
        open ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="animate-fade-in w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-2xl sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cookie className="h-6 w-6" aria-hidden="true" />
          </span>

          <h1 className="mt-4 text-lg font-semibold leading-snug text-foreground sm:text-xl">
            {t('title')}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t('text')}</p>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              size="lg"
              tabIndex={open ? 0 : -1}
              className="w-full flex-1"
              onClick={() => choose(rejectAll)}
            >
              {t('reject')}
            </Button>
            <Button
              ref={acceptRef}
              type="button"
              size="lg"
              tabIndex={open ? 0 : -1}
              className="w-full flex-1"
              onClick={() => choose(acceptAll)}
            >
              {t('accept')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
