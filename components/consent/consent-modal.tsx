'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useConsent } from './consent-provider';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { DEFAULT_CONSENT, type ConsentState } from '@/lib/consent';

export function ConsentModal() {
  const t = useTranslations('consent');
  const { showManager, closeManager, consent, savePreferences, acceptAll, rejectAll } = useConsent();
  const [draft, setDraft] = React.useState<ConsentState>(consent ?? DEFAULT_CONSENT);
  const closeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (showManager) setDraft(consent ?? DEFAULT_CONSENT);
  }, [showManager, consent]);

  React.useEffect(() => {
    if (showManager) closeRef.current?.focus();
  }, [showManager]);

  React.useEffect(() => {
    if (!showManager) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeManager();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showManager, closeManager]);

  if (!showManager) return null;

  const rows: { key: 'functional' | 'analytics' | 'advertising'; title: string; desc: string; locked?: boolean }[] = [
    { key: 'functional', title: t('functional'), desc: t('functionalDesc') },
    { key: 'analytics', title: t('analytics'), desc: t('analyticsDesc') },
    { key: 'advertising', title: t('advertising'), desc: t('advertisingDesc') },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('modalTitle')}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={closeManager}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t('modalTitle')}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('modalText')}</p>
          </div>
          <button
            ref={closeRef}
            onClick={closeManager}
            aria-label={t('close')}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t('necessary')}</p>
              <p className="text-xs text-muted-foreground">{t('necessaryDesc')}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">{t('alwaysOn')}</span>
          </div>
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between rounded-lg border border-border bg-secondary/40 px-4 py-3">
              <div className="pe-4">
                <p className="text-sm font-medium text-foreground">{row.title}</p>
                <p className="text-xs text-muted-foreground">{row.desc}</p>
              </div>
              <Switch
                checked={draft[row.key]}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, [row.key]: v }))}
                label={row.title}
              />
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={rejectAll}>
            {t('rejectAll')}
          </Button>
          <Button size="sm" variant="outline" onClick={acceptAll}>
            {t('acceptAll')}
          </Button>
          <Button size="sm" onClick={() => savePreferences(draft)}>
            {t('savePreferences')}
          </Button>
        </div>
      </div>
    </div>
  );
}
