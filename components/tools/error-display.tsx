'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import type { UploadError } from './file-uploader';
import { resolveUploadMessage } from './error-messages';

interface ErrorDisplayProps {
  error?: UploadError | string | null;
  onRetry?: () => void;
}

export function ErrorDisplay({ error, onRetry }: ErrorDisplayProps) {
  const t = useTranslations();
  if (!error) return null;
  const message = resolveUploadMessage(error, t);

  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
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
