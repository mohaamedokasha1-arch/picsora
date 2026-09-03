'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CURRENCIES, numberToWords, toArabicNumerals } from '@/lib/text-processing/numberToWords';
import {
  CheckboxRow,
  CopyButton,
  Field,
  InlineError,
  PrivacyNotice,
  ResetButton,
  ToggleGroup,
  ToolPanel,
} from '../kit';

export default function NumberToWordsTool() {
  const t = useTranslations();
  const [value, setValue] = React.useState('');
  const [language, setLanguage] = React.useState<'en' | 'ar'>('en');
  const [currencyMode, setCurrencyMode] = React.useState(false);
  const [currency, setCurrency] = React.useState('USD');

  const result = React.useMemo(
    () => (value.trim() ? numberToWords(value, { language, currency: currencyMode ? currency : undefined }) : null),
    [value, language, currencyMode, currency],
  );

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('textTools.input')}
        actions={<ResetButton onClick={() => setValue('')} label={t('textTools.clear')} />}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('textTools.numberLabel')}>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="1234567.89"
              inputMode="decimal"
              dir="ltr"
            />
          </Field>
          <ToggleGroup
            label={t('textTools.outputLanguage')}
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'en', label: 'English' },
              { value: 'ar', label: 'العربية' },
            ]}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="self-end">
            <CheckboxRow checked={currencyMode} onChange={setCurrencyMode} label={t('textTools.currencyMode')} />
          </div>
          {currencyMode && (
            <Field label={t('textTools.currency')}>
              <Select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                options={CURRENCIES.map((c) => ({
                  value: c.code,
                  label: `${c.code} — ${language === 'ar' ? c.arMajor : c.enMajor}`,
                }))}
              />
            </Field>
          )}
        </div>
      </ToolPanel>

      {result?.error && <InlineError message={t('errors.invalidNumberInput')} />}

      {result && !result.error && (
        <ToolPanel title={t('textTools.inWords')} actions={<CopyButton value={result.words} />}>
          <p
            dir={language === 'ar' ? 'rtl' : 'ltr'}
            className="text-lg font-medium leading-relaxed text-foreground"
          >
            {result.words}
          </p>
          {language === 'ar' && (
            <p dir="rtl" className="mt-3 text-sm text-muted-foreground">
              {t('textTools.arabicNumerals')}: <span className="font-medium">{toArabicNumerals(value)}</span>
            </p>
          )}
        </ToolPanel>
      )}

      <PrivacyNotice />
    </div>
  );
}
