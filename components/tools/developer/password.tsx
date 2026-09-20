'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  generatePassword,
  generatePin,
  strengthOf,
  type PasswordOptions,
} from '@/lib/developer-tools/password';
import {
  CheckboxRow,
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ToggleGroup,
  ToolPanel,
} from '../kit';

/** CSPRNG password + PIN generator — secrets never leave the device. */
export default function PasswordGeneratorTool() {
  const t = useTranslations();
  const [mode, setMode] = React.useState<'password' | 'pin'>('password');
  const [options, setOptions] = React.useState<PasswordOptions>({
    length: 16,
    upper: true,
    lower: true,
    digits: true,
    symbols: true,
    excludeAmbiguous: false,
  });
  const [pinLength, setPinLength] = React.useState(6);
  const [history, setHistory] = React.useState<{ value: string; entropy: number | null }[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const set = <K extends keyof PasswordOptions>(key: K, value: PasswordOptions[K]) =>
    setOptions((prev) => ({ ...prev, [key]: value }));

  const generate = React.useCallback(() => {
    setError(null);
    try {
      if (mode === 'pin') {
        const value = generatePin(pinLength);
        setHistory((prev) => [{ value, entropy: pinLength * Math.log2(10) }, ...prev].slice(0, 8));
      } else {
        const { value, entropy } = generatePassword(options);
        setHistory((prev) => [{ value, entropy }, ...prev].slice(0, 8));
      }
    } catch {
      setError(t('errors.passwordNoCharset'));
    }
  }, [mode, options, pinLength, t]);

  React.useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = history[0];
  const strength = current?.entropy !== undefined && current.entropy !== null ? strengthOf(current.entropy) : null;

  return (
    <div className="space-y-5">
      <PrivacyNotice text={t('dev.passwordPrivacy')} />
      <InlineError message={error} />

      <ToolPanel
        title={t('dev.passwordOptions')}
        actions={
          <Button variant="outline" size="sm" onClick={generate}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('dev.regenerate')}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleGroup<'password' | 'pin'>
            label={t('dev.passwordMode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'password', label: t('dev.passwordModePassword') },
              { value: 'pin', label: t('dev.passwordModePin') },
            ]}
          />
          {mode === 'password' ? (
            <Slider
              label={t('dev.passwordLength')}
              min={4}
              max={64}
              value={options.length}
              onValueChange={(v) => set('length', v)}
            />
          ) : (
            <Slider
              label={t('dev.pinLength')}
              min={4}
              max={12}
              value={pinLength}
              onValueChange={setPinLength}
            />
          )}
        </div>
        {mode === 'password' && (
          <div className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            <CheckboxRow checked={options.upper} onChange={(v) => set('upper', v)} label="ABC" />
            <CheckboxRow checked={options.lower} onChange={(v) => set('lower', v)} label="abc" />
            <CheckboxRow checked={options.digits} onChange={(v) => set('digits', v)} label="123" />
            <CheckboxRow checked={options.symbols} onChange={(v) => set('symbols', v)} label="#$&" />
            <CheckboxRow
              checked={options.excludeAmbiguous}
              onChange={(v) => set('excludeAmbiguous', v)}
              label={t('dev.noAmbiguous')}
            />
          </div>
        )}
      </ToolPanel>

      {current && (
        <ToolPanel title={t('textTools.output')} actions={<CopyButton value={current.value} />}>
          <p
            dir="ltr"
            className="break-all rounded-lg border border-input bg-background p-4 text-center font-mono text-lg tracking-wide text-foreground"
          >
            {current.value}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            {strength && (
              <span className="rounded-full bg-secondary px-3 py-1 font-medium text-secondary-foreground">
                {t(`dev.strength_${strength}` as never)} · {Math.round(current.entropy ?? 0)} {t('dev.bits')}
              </span>
            )}
          </div>
          {history.length > 1 && (
            <ul className="mt-4 space-y-2">
              {history.slice(1).map((h, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <span dir="ltr" className="min-w-0 truncate font-mono text-sm text-muted-foreground">
                    {h.value}
                  </span>
                  <CopyButton value={h.value} size="icon-sm" />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3">
            <Notice variant="info">{t('dev.passwordManagerNote')}</Notice>
          </div>
        </ToolPanel>
      )}
    </div>
  );
}
