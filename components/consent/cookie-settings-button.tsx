'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useConsent } from './consent-provider';

/**
 * "Cookie Settings" link shown in the footer.
 *
 * This is NOT a banner — it is a plain text link styled exactly like the
 * other footer links. After the full-screen consent gate has been answered,
 * it re-opens the same choice window so visitors can change their decision
 * at any time (the "Cookie Settings link in the footer" promised by the
 * Cookie Policy).
 */
export function CookieSettingsButton() {
  const t = useTranslations();
  const { openManager } = useConsent();

  return (
    <button
      type="button"
      onClick={openManager}
      className="cursor-pointer rounded-sm text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      {t('common.cookiesSettings')}
    </button>
  );
}
