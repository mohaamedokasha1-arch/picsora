'use client';

import * as React from 'react';
import { ArrowLeftRight, RefreshCw } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  RATE_SOURCE,
  SUPPORTED_CURRENCIES,
  convertCurrency,
  formatMoney,
  getRates,
  type RateSnapshot,
} from '@/lib/calculators/currency';
import { CopyButton, Field, InlineError, Notice, PrivacyNotice, ToolPanel } from '../kit';

export default function CurrencyConverterTool() {
  const t = useTranslations();
  const locale = useLocale();
  const [snapshot, setSnapshot] = React.useState<RateSnapshot | null>(null);
  const [stale, setStale] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [from, setFrom] = React.useState('USD');
  const [to, setTo] = React.useState('SAR');
  const [amount, setAmount] = React.useState('100');

  const load = React.useCallback(async (force = false) => {
    setLoading(true);
    const outcome = await getRates(force);
    setSnapshot(outcome.snapshot);
    setStale(outcome.stale);
    setFailed(outcome.failed && !outcome.snapshot);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const numeric = Number(amount);
  const converted =
    snapshot && Number.isFinite(numeric) ? convertCurrency(numeric, from, to, snapshot) : null;
  const unitRate = snapshot ? convertCurrency(1, from, to, snapshot) : null;

  const options = SUPPORTED_CURRENCIES.map((code) => ({ value: code, label: code }));
  const asOf = snapshot ? new Date(snapshot.fetchedAt).toLocaleString(locale) : '';

  return (
    <div className="space-y-5">
      {failed && <InlineError message={t('errors.ratesUnavailable')} />}
      {stale && snapshot && <Notice variant="warning">{t('calc.cachedRates', { date: asOf })}</Notice>}

      <ToolPanel
        title={t('calc.convert')}
        actions={
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('calc.refreshRates')}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-3">
            <Field label={t('calc.amount')}>
              <Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} dir="ltr" />
            </Field>
            <Field label={t('calc.fromCurrency')}>
              <Select value={from} onChange={(e) => setFrom(e.target.value)} options={options} />
            </Field>
          </div>

          <div className="flex items-end justify-center pb-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setFrom(to);
                setTo(from);
              }}
              aria-label={t('calc.swapCurrencies')}
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-3">
            <Field label={t('calc.converted')}>
              <div className="flex h-10 items-center rounded-md border border-input bg-secondary/40 px-3 text-sm font-semibold tabular-nums text-foreground" dir="ltr">
                {converted !== null ? formatMoney(converted, to, locale) : loading ? t('common.loading') : '—'}
              </div>
            </Field>
            <Field label={t('calc.toCurrency')}>
              <Select value={to} onChange={(e) => setTo(e.target.value)} options={options} />
            </Field>
          </div>
        </div>

        {unitRate !== null && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground" dir="ltr">
              1 {from} = {unitRate.toFixed(4)} {to}
            </p>
            <CopyButton value={`1 ${from} = ${unitRate.toFixed(4)} ${to}`} />
          </div>
        )}
      </ToolPanel>

      {snapshot && (
        <ToolPanel title={t('calc.allRates', { base: from })}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {SUPPORTED_CURRENCIES.filter((code) => code !== from).map((code) => {
              const rate = convertCurrency(1, from, code, snapshot);
              return (
                <li
                  key={code}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-foreground">{code}</span>
                  <span className="tabular-nums text-muted-foreground" dir="ltr">
                    {rate !== null ? rate.toFixed(4) : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        </ToolPanel>
      )}

      {snapshot && (
        <Notice>
          {t('calc.ratesSource', { source: RATE_SOURCE, date: asOf })}
        </Notice>
      )}
      <Notice variant="privacy">{t('calc.currencyPrivacy')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
