'use client';

import { useTranslations } from 'next-intl';

interface ProcessingIndicatorProps {
  progress?: number; // 0..100, undefined = indeterminate
  current?: number;
  total?: number;
}

export function ProcessingIndicator({ progress, current, total }: ProcessingIndicatorProps) {
  const t = useTranslations('toolShell');
  return (
    <div role="status" aria-live="polite" className="w-full rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            {t('processingTitle')}
            {current && total ? ` — ${t('progress', { current, total })}` : '…'}
          </p>
        </div>
        {progress !== undefined && (
          <span className="text-sm font-semibold tabular-nums text-primary">{Math.round(progress)}%</span>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-200"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
