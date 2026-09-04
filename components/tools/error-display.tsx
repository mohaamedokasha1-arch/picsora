'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { UploadError } from './file-uploader';

interface ErrorDisplayProps {
  error?: UploadError | string | null;
  onRetry?: () => void;
}

function resolveMessage(error: UploadError | string, t: (key: string, params?: Record<string, string | number>) => string): string {
  if (typeof error === 'string') return error;
  const known: Record<string, string> = {
    emptyFile: 'validation.emptyFile',
    fileTooLarge: 'validation.fileTooLarge',
    invalidType: 'validation.invalidType',
    mimeMismatch: 'validation.mimeMismatch',
    tooManyFiles: 'validation.tooManyFiles',
    corruptImage: 'validation.corruptImage',
    noFile: 'validation.noFile',
    readError: 'validation.readError',
    'dimensions-too-large': 'errors.dimensionsTooLarge',
    'file-too-large': 'validation.fileTooLarge',
    'heic-conversion-failed': 'errors.heicFailed',
    'heic-unsupported': 'errors.heicUnsupported',
    'webp-unsupported': 'errors.webpUnsupported',
    'decode-failed': 'errors.decodeFailed',
    'encode-failed': 'errors.processingFailed',
    'no-2d-context': 'errors.processingFailed',
    'need-at-least-two': 'errors.processingFailed',
    'zip-failed': 'errors.zipFailed',
    'pdf-failed': 'errors.pdfFailed',
    'qr-failed': 'errors.qrFailed',
    'ocr-failed': 'errors.ocrFailed',
    'jwt-invalid': 'errors.jwtInvalid',
    'yaml-invalid': 'errors.yamlInvalid',
  };
  const key = known[error.key] || `errors.${error.key}` || `validation.${error.key}`;
  try {
    const msg = t(key, error.params);
    if (msg && msg !== key) return msg;
  } catch {
    /* fallback to generic */
  }
  return t('errors.generic');
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const t = useTranslations();
  if (!error) return null;
  const message = resolveMessage(error, t);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{t('errors.title')}</p>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.tryAgain')}
        </Button>
      )}
    </div>
  );
}
