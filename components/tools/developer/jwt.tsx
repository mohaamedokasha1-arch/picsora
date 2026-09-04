'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { KeyRound, ShieldAlert, ShieldCheck, Clock, Copy, Check } from 'lucide-react';
import { ToolPanel, CopyButton, ResetButton, PrivacyNotice, TextArea, CodeArea } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';

function base64UrlDecode(str: string): string {
  let output = str.replace(/-/g, '+').replace(/_/g, '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Illegal base64url string');
  }
  return decodeURIComponent(
    atob(output)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );
}

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFsZXggSm9obnNvbiIsImFkbWluIjp0cnVlLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

export default function JwtDecoder() {
  const t = useTranslations();
  const [token, setToken] = React.useState<string>(SAMPLE_JWT);
  const [headerJson, setHeaderJson] = React.useState<string>('');
  const [payloadJson, setPayloadJson] = React.useState<string>('');
  const [signature, setSignature] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);
  const [expInfo, setExpInfo] = React.useState<{ isExpired: boolean; date: string; relative: string } | null>(null);

  React.useEffect(() => {
    if (!token.trim()) {
      setHeaderJson('');
      setPayloadJson('');
      setSignature('');
      setError(null);
      setExpInfo(null);
      return;
    }

    const parts = token.trim().split('.');
    if (parts.length !== 3) {
      setError('Invalid JWT format: A JSON Web Token must contain 3 dot-separated parts (Header.Payload.Signature).');
      setHeaderJson('');
      setPayloadJson('');
      setSignature('');
      setExpInfo(null);
      return;
    }

    try {
      const headerStr = base64UrlDecode(parts[0]);
      const payloadStr = base64UrlDecode(parts[1]);

      const headerObj = JSON.parse(headerStr);
      const payloadObj = JSON.parse(payloadStr);

      setHeaderJson(JSON.stringify(headerObj, null, 2));
      setPayloadJson(JSON.stringify(payloadObj, null, 2));
      setSignature(parts[2]);
      setError(null);

      // Check exp
      if (typeof payloadObj.exp === 'number') {
        const expDate = new Date(payloadObj.exp * 1000);
        const now = new Date();
        const diffSec = Math.round((expDate.getTime() - now.getTime()) / 1000);
        const isExpired = diffSec < 0;

        let relative = '';
        const absDiff = Math.abs(diffSec);
        if (absDiff < 60) relative = `${absDiff} seconds ${isExpired ? 'ago' : 'from now'}`;
        else if (absDiff < 3600) relative = `${Math.floor(absDiff / 60)} minutes ${isExpired ? 'ago' : 'from now'}`;
        else if (absDiff < 86400) relative = `${Math.floor(absDiff / 3600)} hours ${isExpired ? 'ago' : 'from now'}`;
        else relative = `${Math.floor(absDiff / 86400)} days ${isExpired ? 'ago' : 'from now'}`;

        setExpInfo({
          isExpired,
          date: expDate.toUTCString(),
          relative,
        });
      } else {
        setExpInfo(null);
      }
    } catch {
      setError('Could not decode token parts. Please ensure it is a valid Base64URL-encoded JWT.');
      setHeaderJson('');
      setPayloadJson('');
      setSignature('');
      setExpInfo(null);
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <ToolPanel
        title="Encoded JWT Token"
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setToken(SAMPLE_JWT)}
            >
              Load Example
            </Button>
            <ResetButton onClick={() => setToken('')} />
          </div>
        }
      >
        <TextArea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste your JWT token here (e.g. eyJhbGciOi...)"
          className="h-28 font-mono text-xs break-all"
        />
      </ToolPanel>

      {error && (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {expInfo && (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 ${
            expInfo.isExpired
              ? 'border-rose-500/30 bg-rose-500/10 text-rose-900 dark:text-rose-200'
              : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          {expInfo.isExpired ? (
            <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <div className="text-sm">
            <span className="font-bold">
              {expInfo.isExpired ? 'Token Expired' : 'Token Valid (Active)'}
            </span>
            <span className="ms-2 opacity-90">
              — Expires on {expInfo.date} ({expInfo.relative})
            </span>
          </div>
        </div>
      )}

      {payloadJson && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Header */}
          <ToolPanel
            title="Header: Algorithm & Token Type"
            actions={<CopyButton value={headerJson} />}
          >
            <CodeArea
              value={headerJson}
              readOnly
              ariaLabel="Decoded JWT Header"
              minHeight={180}
            />
          </ToolPanel>

          {/* Payload */}
          <ToolPanel
            title="Payload: Claims & Data"
            actions={<CopyButton value={payloadJson} />}
          >
            <CodeArea
              value={payloadJson}
              readOnly
              ariaLabel="Decoded JWT Payload"
              minHeight={180}
            />
          </ToolPanel>
        </div>
      )}

      {signature && (
        <ToolPanel
          title="Signature"
          actions={<CopyButton value={signature} />}
        >
          <div className="rounded-lg border border-border bg-secondary/30 p-3 font-mono text-xs break-all text-muted-foreground">
            {signature}
          </div>
        </ToolPanel>
      )}

      <PrivacyNotice text="JWT tokens are decoded 100% locally in your browser. Secrets and tokens are never sent to any server." />
    </div>
  );
}
