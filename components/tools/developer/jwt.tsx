'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  decodeJwt,
  formatUnix,
  jwtTimes,
  verifyHmac,
  type JwtDecoded,
} from '@/lib/developer-tools/jwt';
import {
  CodeArea,
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  ToolPanel,
} from '../kit';
import { CodeBlock } from './highlight';

/** Decode (and optionally verify) JSON Web Tokens — fully offline. */
export default function JwtDecoderTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const [decoded, setDecoded] = React.useState<JwtDecoded | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState('');
  const [verdict, setVerdict] = React.useState<'valid' | 'invalid' | 'error' | null>(null);
  const [verifying, setVerifying] = React.useState(false);

  const decode = React.useCallback(
    (value: string) => {
      setVerdict(null);
      if (!value.trim()) {
        setDecoded(null);
        setError(null);
        return;
      }
      try {
        setDecoded(decodeJwt(value));
        setError(null);
      } catch {
        setDecoded(null);
        setError(t('errors.jwtInvalid'));
      }
    },
    [t],
  );

  // Live decode as the user types/pastes.
  React.useEffect(() => {
    const id = window.setTimeout(() => decode(input), 250);
    return () => window.clearTimeout(id);
  }, [input, decode]);

  const verify = async () => {
    if (!decoded) return;
    setVerifying(true);
    setVerdict(null);
    try {
      const ok = await verifyHmac(decoded, secret);
      setVerdict(ok ? 'valid' : 'invalid');
    } catch {
      setVerdict('error');
    } finally {
      setVerifying(false);
    }
  };

  const reset = () => {
    setInput('');
    setDecoded(null);
    setError(null);
    setSecret('');
    setVerdict(null);
  };

  const times = decoded ? jwtTimes(decoded.payload) : null;
  const headerPretty = decoded ? JSON.stringify(decoded.header, null, 2) : '';
  const payloadPretty = decoded ? JSON.stringify(decoded.payload, null, 2) : '';

  return (
    <div className="space-y-5">
      <ToolPanel title={t('jwt.tokenLabel')} actions={<ResetButton onClick={reset} />}>
        <CodeArea
          value={input}
          onChange={setInput}
          ariaLabel={t('jwt.tokenLabel')}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
          minHeight={120}
        />
      </ToolPanel>

      <InlineError message={error} />

      {decoded && (
        <>
          <StatGrid
            columns={4}
            items={[
              { label: t('jwt.algorithm'), value: decoded.algorithm },
              {
                label: t('jwt.expires'),
                value: times?.expiresAt ? formatUnix(times.expiresAt) : '—',
                accent: times?.expired === true,
              },
              {
                label: t('jwt.status'),
                value:
                  times?.expired === null
                    ? t('jwt.noExpiry')
                    : times?.expired
                      ? t('jwt.expired')
                      : t('jwt.active'),
                accent: times?.expired === true,
              },
              { label: t('jwt.issuedAt'), value: times?.issuedAt ? formatUnix(times.issuedAt) : '—' },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-2">
            <ToolPanel
              title={t('jwt.header')}
              actions={<CopyButton value={headerPretty} size="sm" />}
            >
              <CodeBlock code={headerPretty} language="json" ariaLabel={t('jwt.header')} />
            </ToolPanel>
            <ToolPanel
              title={t('jwt.payload')}
              actions={<CopyButton value={payloadPretty} size="sm" />}
            >
              <CodeBlock code={payloadPretty} language="json" ariaLabel={t('jwt.payload')} />
            </ToolPanel>
          </div>

          <ToolPanel title={t('jwt.verifyTitle')}>
            <p className="mb-3 text-sm text-muted-foreground">{t('jwt.verifyHint')}</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder={t('jwt.secretPlaceholder')}
                className="flex-1 font-mono"
                aria-label={t('jwt.secretPlaceholder')}
                autoComplete="off"
                spellCheck={false}
              />
              <Button onClick={verify} disabled={verifying || !secret} loading={verifying}>
                {t('jwt.verifyAction')}
              </Button>
            </div>
            {verdict === 'valid' && (
              <div className="mt-3"><Notice variant="privacy">{t('jwt.validSig')}</Notice></div>
            )}
            {verdict === 'invalid' && (
              <div className="mt-3"><InlineError message={t('jwt.invalidSig')} /></div>
            )}
            {verdict === 'error' && (
              <div className="mt-3"><InlineError message={t('jwt.unsupportedAlg')} /></div>
            )}
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground" dir="ltr">
              {decoded.signature}
            </p>
          </ToolPanel>
        </>
      )}

      {!decoded && !error && <Notice>{t('jwt.introHint')}</Notice>}
      <PrivacyNotice text={t('jwt.privacyNote')} />
    </div>
  );
}
