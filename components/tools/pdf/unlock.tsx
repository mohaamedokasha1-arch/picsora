'use client';

import * as React from 'react';
import { Eye, EyeOff, Unlock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes, sanitizeFilename } from '@/lib/utils';
import { unlockPdf } from '@/lib/pdf-processing';
import { PdfDropzone, useErrorText } from './shared';
import { Field, InlineError, Notice, PrivacyNotice, ResetButton, ToolPanel } from '../kit';

const MAX_MB = 100;

export default function PdfUnlockTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const [file, setFile] = React.useState<File | null>(null);
  const [password, setPassword] = React.useState('');
  const [show, setShow] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Blob | null>(null);

  const unlock = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await unlockPdf(file, password));
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const clearAll = () => {
    setFile(null);
    setPassword('');
    setResult(null);
    setError(null);
  };

  const baseName = file ? sanitizeFilename(file.name.replace(/\.pdf$/i, ''), 'document') : 'document';

  return (
    <div className="space-y-5">
      <InlineError message={error} />

      {!file && (
        <>
          <PdfDropzone
            maxFileSizeMB={MAX_MB}
            onFiles={(files) => {
              setFile(files[0] ?? null);
              setError(null);
            }}
            onError={setError}
          />
          <Notice variant="warning">{t('pdfTools.unlockLegal')}</Notice>
          <PrivacyNotice />
        </>
      )}

      {file && (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
          </div>

          <ToolPanel title={t('pdfTools.enterPassword')} actions={<ResetButton onClick={clearAll} />}>
            <div className="max-w-sm">
              <Field label={t('pdfTools.currentPassword')}>
                <div className="relative">
                  <Input
                    type={show ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && unlock()}
                    autoComplete="off"
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
            </div>

            <div className="mt-4">
              <Button onClick={unlock} disabled={busy || !password} loading={busy}>
                <Unlock className="h-4 w-4" />
                {t('pdfTools.unlockAction')}
              </Button>
            </div>
          </ToolPanel>

          <Notice variant="warning">{t('pdfTools.unlockLegal')}</Notice>
        </>
      )}

      {result && (
        <ToolPanel title={t('toolShell.resultTitle')}>
          <div className="flex flex-wrap items-center gap-3">
            <DownloadButton blob={result} filename={`${baseName}-unlocked.pdf`} />
            <ResetButton onClick={clearAll} />
          </div>
        </ToolPanel>
      )}
    </div>
  );
}
