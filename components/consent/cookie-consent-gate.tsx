'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Cookie } from 'lucide-react';
import { readConsentCookie } from '@/lib/consent';
import { useConsent } from './consent-provider';
import { Link } from '@/lib/i18n/navigation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Phase = 'pending' | 'open' | 'leaving' | 'closed';

/**
 * Cookie consent banner — a non-blocking notice pinned to the bottom of the
 * viewport on first visit.
 *
 * Previously this was a full-screen modal that left the site inert until a
 * choice was made. That behaviour was changed on purpose:
 *
 * - Google AdSense reviews penalise content hidden behind interstitials, and
 *   a first-time visitor (or a reviewer) saw a wall instead of the site.
 * - Consent remains fully valid: no analytics/advertising script runs until
 *   the visitor accepts, the choice persists in a cookie, and the choice can
 *   be changed any time via "Cookie Settings" in the footer.
 *
 * The banner never blocks reading or navigation; it simply asks, and stays
 * out of the way afterwards.
 */
export function CookieConsentGate() {
  const t = useTranslations('consent');
  const { acceptAll, rejectAll } = useConsent();
  const [phase, setPhase] = React.useState<Phase>('pending');
  const timerRef = React.useRef<number | undefined>(undefined);

  // Reveal the banner right after the first paint, unless the visitor already
  // made a choice on a previous visit (stored consent cookie).
  React.useEffect(() => {
    if (readConsentCookie() !== null) {
      setPhase('closed');
      return;
    }
    const id = window.requestAnimationFrame(() => setPhase('open'));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const choose = (apply: () => void) => {
    if (phase !== 'open') return;
    setPhase('leaving');
    // Small fade-out, then persist the choice for good.
    timerRef.current = window.setTimeout(() => {
      apply();
      setPhase('closed');
    }, 200);
  };

  React.useEffect(() => () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current);
  }, []);

  if (phase === 'pending' || phase === 'closed') return null;

  const open = phase === 'open';

  return (
    <div
      role="region"
      aria-label={t('title')}
      className={cn(
        'fixed inset-x-0 bottom-0 z-[80] border-t border-border bg-card/95 shadow-[0_-8px_30px_rgb(0_0_0/0.08)] backdrop-blur transition-all duration-300',
        open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
    >
      <div className="container flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="flex flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Cookie className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">{t('title')}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {t('text')}{' '}
              <Link href="/cookie-policy" className="font-medium text-primary hover:underline">
                {t('policy')}
              </Link>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2.5">
          <Button type="button" variant="outline" onClick={() => choose(rejectAll)}>
            {t('reject')}
          </Button>
          <Button type="button" onClick={() => choose(acceptAll)}>
            {t('accept')}
          </Button>
        </div>
      </div>
    </div>
  );
}
