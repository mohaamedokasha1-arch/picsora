'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { Input } from '@/components/ui/input';
import { decodeJwt, signJwt, verifyHmac, type JwtSignAlgorithm } from '@/lib/developer-tools/jwt';
import {
  CodeArea,
  CopyButton,
  Field,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  ToggleGroup,
  ToolPanel,
} from '../kit';

const DEFAULT_PAYLOAD = '{\n  "sub": "1234567890",\n  "name": "Layla Hassan",\n  "iat": 1758326400\n}';

/** Sign HS256/384/512 JWTs and verify them — keys never leave the browser. */
export default function JwtEncoderTool() {
  const t = useTranslations();
  const [payload, setPayload] = React.useState(DEFAULT_PAYLOAD);
  const [secret, setSecret] = React.useState('your-256-bit-secret');
  const [algorithm, setAlgorithm] = React.useState<JwtSignAlgorithm>('HS256');
  const [token, setToken] = React.useState('');
  const [verifyToken, setVerifyToken] = React.useState('');
  const [verdict, setVerdict] = React.useState<boolean | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [verifyError, setVerifyError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const sign = async () => {
    setBusy(true);
    setError(null);
    try {
      const out = await signJwt('{"typ":"JWT"}', payload, secret, algorithm);
      setToken(out);
    } catch {
      setError(t('errors.jwtInvalid'));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setVerifyError(null);
    setVerdict(null);
    try {
      const decoded = decodeJwt(verifyToken);
      const ok = await verifyHmac(decoded, secret);
      setVerdict(ok);
    } catch {
      setVerifyError(t('errors.jwtInvalid'));
    }
  };

  return (
    <div className="space-y-5">
      <PrivacyNotice text={t('dev.jwtPrivacy')} />
      <InlineError message={error} />

      <ToolPanel title={t('dev.jwtSignTitle')}>
        <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <ToggleGroup<JwtSignAlgorithm>
            label={t('dev.jwtAlgorithm')}
            value={algorithm}
            onChange={setAlgorithm}
            options={[
              { value: 'HS256', label: 'HS256' },
              { value: 'HS384', label: 'HS384' },
              { value: 'HS512', label: 'HS512' },
            ]}
          />
          <Field label={t('dev.jwtSecret')}>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="off"
              dir="ltr"
              className="md:w-64"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label={t('dev.jwtPayload')}>
            <CodeArea value={payload} onChange={setPayload} ariaLabel={t('dev.jwtPayload')} minHeight={160} />
          </Field>
        </div>
        <div className="mt-4">
          <ActionButton onClick={sign} disabled={busy} processing={busy} className="w-full sm:w-auto">
            {t('dev.jwtSignAction')}
          </ActionButton>
        </div>
        {token && (
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">{t('dev.jwtToken')}</span>
              <CopyButton value={token} />
            </div>
            <p dir="ltr" className="break-all rounded-lg border border-input bg-background p-3 font-mono text-xs leading-relaxed text-foreground">
              {token}
            </p>
            <Notice variant="info">{t('dev.jwtShareWarning')}</Notice>
          </div>
        )}
      </ToolPanel>

      <ToolPanel title={t('dev.jwtVerifyTitle')}>
        <Field label={t('dev.jwtToken')}>
          <CodeArea
            value={verifyToken}
            onChange={(v) => {
              setVerifyToken(v);
              setVerdict(null);
            }}
            ariaLabel={t('dev.jwtToken')}
            minHeight={110}
            placeholder="eyJhbGciOi…"
          />
        </Field>
        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton onClick={verify} disabled={!verifyToken.trim()} className="w-full sm:w-auto">
            {t('dev.jwtVerifyAction')}
          </ActionButton>
          <ResetButton
            onClick={() => {
              setVerifyToken('');
              setVerdict(null);
              setVerifyError(null);
            }}
          />
        </div>
        <div className="mt-3">
          <InlineError message={verifyError} />
          {verdict !== null && (
            <Notice variant={verdict ? 'privacy' : 'warning'}>
              {verdict ? t('dev.jwtValid') : t('dev.jwtInvalidSig')}
            </Notice>
          )}
        </div>
      </ToolPanel>
    </div>
  );
}
