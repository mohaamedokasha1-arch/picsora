'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { CopyButton, InlineError, PrivacyNotice, ResetButton, ToolPanel, useDebounced } from '../kit';
import { parseUrlParts, queryToJson, urlReport, type ParsedUrl } from '@/lib/developer-tools/url';

/** Protocol / host / path… one row per component, each independently copyable. */
function PartRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border py-2.5 last:border-0">
      <div className="min-w-0">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="break-all font-mono text-[13px] text-foreground" dir="ltr">
          {value || <span className="text-muted-foreground">—</span>}
        </div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <CopyButton value={value} size="icon-sm" />
    </div>
  );
}

export default function UrlParserTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const debounced = useDebounced(input, 250);

  const parsed = React.useMemo(() => {
    if (!debounced.trim()) return null;
    return parseUrlParts(debounced);
  }, [debounced]);

  const value: ParsedUrl | null = parsed?.ok ? parsed.value : null;

  const rows = value
    ? [
        { label: t('dev.protocol'), value: value.protocol },
        { label: t('dev.origin'), value: value.origin },
        { label: t('dev.host'), value: value.host },
        { label: t('dev.hostname'), value: value.hostname },
        { label: t('dev.port'), value: value.port },
        { label: t('dev.path'), value: value.pathname },
        { label: t('dev.query'), value: value.search },
        { label: t('dev.hash'), value: value.hash },
        { label: t('dev.username'), value: value.username },
        { label: t('dev.password'), value: value.password ? '•'.repeat(value.password.length) : '' },
      ]
    : [];

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('dev.urlToParse')}
        actions={<ResetButton onClick={() => setInput('')} label={t('textTools.clear')} />}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="https://example.com:8080/blog/post?id=42&lang=ar#comments"
          dir="ltr"
          spellCheck={false}
          aria-label={t('dev.urlToParse')}
        />
        <p className="mt-2 text-xs text-muted-foreground">{t('dev.urlHint')}</p>
      </ToolPanel>

      {!debounced.trim() && (
        <ToolPanel>
          <p className="text-sm text-muted-foreground">{t('dev.urlEmptyState')}</p>
        </ToolPanel>
      )}

      {parsed && !parsed.ok && <InlineError message={t('dev.invalidUrl')} />}

      {value && (
        <>
          {value.assumedProtocol && (
            <p className="rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              {t('dev.assumedProtocol')}
            </p>
          )}

          <ToolPanel
            title={t('dev.components')}
            actions={<CopyButton value={urlReport(value)} label={t('dev.copyComponents')} />}
          >
            <div>
              {rows.map((row) => (
                <PartRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </ToolPanel>

          <ToolPanel
            title={t('dev.queryParams', { count: value.params.length })}
            actions={
              value.params.length ? (
                <CopyButton value={queryToJson(value.params)} label={t('dev.copyAsJson')} />
              ) : undefined
            }
          >
            {value.params.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dev.noQueryParams')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase text-muted-foreground">
                      <th className="p-2 text-start font-medium">{t('dev.paramKey')}</th>
                      <th className="p-2 text-start font-medium">{t('dev.paramValue')}</th>
                      <th className="p-2 text-end font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {value.params.map((param, i) => (
                      <tr key={`${param.key}-${i}`} className="border-b border-border/60 last:border-0">
                        <td className="max-w-[220px] truncate p-2 font-mono text-[13px] text-foreground" dir="ltr" title={param.key}>
                          {param.key}
                        </td>
                        <td className="max-w-[320px] truncate p-2 font-mono text-[13px] text-muted-foreground" dir="ltr" title={param.value}>
                          {param.value || '—'}
                        </td>
                        <td className="p-2 text-end">
                          <CopyButton value={`${param.key}=${param.value}`} size="icon-sm" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ToolPanel>
        </>
      )}

      <PrivacyNotice text={t('common.allProcessingText')} />
    </div>
  );
}
