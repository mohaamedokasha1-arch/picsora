'use client';

import * as React from 'react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/lib/i18n/navigation';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const toggle = () => {
    const next = locale === 'ar' ? 'en' : 'ar';
    router.replace(pathname, { locale: next });
  };

  return (
    <Button variant="ghost" size="sm" onClick={toggle} aria-label="Language" className="gap-1.5 px-2.5">
      <Languages className="h-4 w-4" />
      <span className="text-xs font-semibold uppercase">{locale === 'ar' ? 'EN' : 'ع'}</span>
    </Button>
  );
}
