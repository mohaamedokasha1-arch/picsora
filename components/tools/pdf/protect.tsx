'use client';

import * as React from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DownloadButton } from '@/components/tools/download-button';
import { cn, sanitizeFilename } from '@/lib/utils';
import { protectPdf } from '@/lib/pdf-processing';
import { PdfDropzone, PdfInfoCard, useSinglePdf } from './shared';
import { CheckboxRow, Field, InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;

type Strength = 'weak' | 'medium' | 'strong';

export function passwordStrength(password: string): Strength {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (score >= 4) return 'strong';
  if (score >= 2) return 'medium';
  return 'weak';
}

export default function PdfProtectTool() {
  const t = useTranslations();
  const { file, info, error, setError, load, reset, errorText } = useSinglePdf();
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [ownerOpen, setOwnerOpen] = React.useState(false);
  const [ownerPassword, setOwnerPassword] = React.useState('');
  const [allowPrinting, setAllowPrinting] = React.useState(true);
  const [allowCopying, setAllowCopying] = React.useState(true);
  const [allowModifying, setAllowModifying] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const strength = passwordStrength(password);
  const mismatch = Boolean(confirm) && password !== confirm;
  const tooShort = Boolean(password) && password.length < 4;
  const canSubmit = password.length >= 4 && password === confirm && !busy && Boolean(file);

  const protect = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setResult(
        await protectPdf(file, {
          userPassword: password,
          ownerPassword: ownerPassword || undefined,
          allowPrinting,
          allowCopying,
          allowModifying,
        }),
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    reset();
    setPassword('');
    setConfirm('');
    setOwnerPassword('');
    setResult(null);
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone maxFileSizeMB={MAX_MB} onFiles={load} onError={setError} />
          <PrivacyNotice text={t('pdfTools.protectPrivacy')} />
        </>
      )}

      {file && info && (
        <>
          <PdfInfoCard info={info} onRemove={clearAll} />

          <ToolPanel title={t('pdfTools.setPassword')} actions={<ResetButton onClick={clearAll} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('pdfTools.password')}>
                <div className="relative">
                  <Input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setResult(null);
                    }}
                    autoComplete="new-password"
                    dir="ltr"
                    className="pe-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShow((v) => !v)}
                    aria-label={show ? t('pdfTools.hidePassword') : t('pdfTools.showPassword')}
                    className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </Field>

              <Field label={t('pdfTools.confirmPassword')}>
                <Input
                  type={show ? 'text' : 'password'}
                  value={confirm}
                  onChange={(e) => {
                    setConfirm(e.target.value);
                    setResult(null);
                  }}
                  autoComplete="new-password"
                  dir="ltr"
                />
              </Field>
            </div>

            {password && (
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t('pdfTools.strength')}:</span>
                  <span
                    className={cn(
                      'font-semibold',
                      strength === 'strong' && 'text-emerald-600 dark:text-emerald-400',
                      strength === 'medium' && 'text-amber-600 dark:text-amber-400',
                      strength === 'weak' && 'text-destructive',
                    )}
                  >
                    {t(`pdfTools.strength_${strength}` as never)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      strength === 'strong' && 'w-full bg-emerald-500',
                      strength === 'medium' && 'w-2/3 bg-amber-500',
                      strength === 'weak' && 'w-1/3 bg-destructive',
                    )}
                  />
                </div>
              </div>
            )}

            {tooShort && <p className="mt-2 text-sm text-destructive">{t('errors.pdfPasswordShort')}</p>}
            {mismatch && <p className="mt-2 text-sm text-destructive">{t('errors.pdfPasswordMismatch')}</p>}
            {!tooShort && strength === 'weak' && password && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">{t('pdfTools.weakPasswordWarning')}</p>
            )}

            <div className="mt-4 rounded-lg border border-border p-3">
              <button
                type="button"
                onClick={() => setOwnerOpen((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-medium text-foreground"
                aria-expanded={ownerOpen}
              >
                {t('pdfTools.ownerSection')}
                <span aria-hidden="true">{ownerOpen ? '−' : '+'}</span>
              </button>
              {ownerOpen && (
                <div className="mt-3 space-y-3">
                  <Field label={t('pdfTools.ownerPassword')}>
                    <Input
                      type={show ? 'text' : 'password'}
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      dir="ltr"
                    />
                  </Field>
                  <p className="text-xs text-muted-foreground">{t('pdfTools.ownerHint')}</p>
                  <div className="space-y-1">
                    <CheckboxRow checked={allowPrinting} onChange={setAllowPrinting} label={t('pdfTools.allowPrinting')} />
                    <CheckboxRow checked={allowCopying} onChange={setAllowCopying} label={t('pdfTools.allowCopying')} />
                    <CheckboxRow checked={allowModifying} onChange={setAllowModifying} label={t('pdfTools.allowEditing')} />
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4">
              <Button onClick={protect} disabled={!canSubmit} loading={busy}>
                <ShieldCheck className="h-4 w-4" />
                {t('pdfTools.protectAction')}
              </Button>
            </div>
          </ToolPanel>

          <Notice variant="privacy">{t('pdfTools.protectPrivacy')}</Notice>
        </>
      )}

      {result && (
        <ToolPanel title={t('toolShell.resultTitle')}>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton blob={result} filename={`${baseName}-protected.pdf`} />
            <ResetButton onClick={clearAll} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t('pdfTools.protectDone')}</p>
        </ToolPanel>
      )}
    </div>
  );
}
