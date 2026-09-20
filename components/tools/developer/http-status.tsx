'use client';

import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { lookupStatus, searchStatuses, type HttpStatusGroup } from '@/lib/developer-tools/http-status';
import { CopyButton, Field, PrivacyNotice, ToggleGroup, ToolPanel } from '../kit';

const GROUPS: ('all' | HttpStatusGroup)[] = ['all', '1xx', '2xx', '3xx', '4xx', '5xx'];

const GROUP_TONE: Record<HttpStatusGroup, string> = {
  '1xx': 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  '2xx': 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  '3xx': 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  '4xx': 'bg-orange-500/10 text-orange-700 dark:text-orange-300',
  '5xx': 'bg-red-500/10 text-red-700 dark:text-red-300',
};

/** Searchable HTTP status code reference — instant lookup, offline. */
export default function HttpStatusTool() {
  const t = useTranslations();
  const locale = useLocale();
  const [query, setQuery] = React.useState('');
  const [group, setGroup] = React.useState<'all' | HttpStatusGroup>('all');

  const results = React.useMemo(() => {
    const found = searchStatuses(query);
    return group === 'all' ? found : found.filter((s) => s.group === group);
  }, [query, group]);

  const exact = React.useMemo(() => {
    const code = Number(query.trim());
    return Number.isInteger(code) ? lookupStatus(code) : undefined;
  }, [query]);

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <ToolPanel title={t('dev.httpSearch')}>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <Field label={t('dev.httpQuery')}>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('dev.httpPlaceholder')}
              inputMode="search"
              dir="ltr"
            />
          </Field>
          <ToggleGroup<'all' | HttpStatusGroup>
            label={t('dev.httpGroup')}
            value={group}
            onChange={setGroup}
            options={GROUPS.map((g) => ({ value: g, label: g === 'all' ? t('dev.httpAll') : g }))}
          />
        </div>
      </ToolPanel>

      <ToolPanel
        title={t('dev.httpResults', { count: results.length })}
        actions={exact ? <CopyButton value={`${exact.code} ${exact.phrase}`} /> : undefined}
      >
        {results.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('common.searchNoResults')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {results.map((s) => (
              <li key={s.code} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
                <span className="flex shrink-0 items-center gap-2">
                  <span
                    dir="ltr"
                    className={`rounded-md px-2 py-0.5 font-mono text-sm font-bold tabular-nums ${GROUP_TONE[s.group]}`}
                  >
                    {s.code}
                  </span>
                  <span className="font-semibold text-foreground">{s.phrase}</span>
                </span>
                <span className="min-w-0 text-sm text-muted-foreground">
                  {locale === 'ar' ? s.meaningAr : s.meaning}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ToolPanel>
    </div>
  );
}
