'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useConsent } from './consent-provider';
import { Button } from '@/components/ui/button';

export function CookieBanner() {
  const t = useTranslations('consent');
  const { decided, acceptAll, rejectAll, openManager } = useConsent();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);
  // Keep space reserved for the banner to avoid CLS when it appears.
  if (!mounted) return <div aria-hidden className="h-2" />;
  if (decided) return null;

  return (
    <div
      role="region"
      aria-label={t('title')}
      className="sticky bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <div className="container flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{t('title')}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('text')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={acceptAll}>
            {t('acceptAll')}
          </Button>
          <Button size="sm" variant="outline" onClick={rejectAll}>
            {t('rejectAll')}
          </Button>
          <Button size="sm" variant="ghost" onClick={openManager}>
            {t('manage')}
          </Button>
        </div>
      </div>
    </div>
  );
}
