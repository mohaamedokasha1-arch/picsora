'use client';

import * as React from 'react';
import { FileText, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProcessResult } from '@/lib/types';
import { formatBytes, formatPercent } from '@/lib/utils';
import { DownloadButton } from './download-button';

interface ResultPanelProps {
  results: ProcessResult[];
  originalSize?: number;
  onReset?: () => void;
}

function isImage(r: ProcessResult) {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(r.format);
}

function ResultCard({ result, originalSize, index }: { result: ProcessResult; originalSize?: number; index: number }) {
  const t = useTranslations('toolShell');
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isImage(result)) return;
    const u = URL.createObjectURL(result.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-secondary/40">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={result.name} className="h-full w-full object-contain" />
        ) : result.format === 'pdf' ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <FileText className="h-10 w-10" />
            <span className="text-xs font-medium">PDF</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-8 w-8" />
            <span className="text-xs">{result.format.toUpperCase()}</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="truncate text-xs text-muted-foreground" title={result.name}>
          {result.name}
        </div>
        <div className="flex items-center gap-2 text-xs">
          {originalSize !== undefined && (
            <>
              <span className="text-muted-foreground line-through">{t('originalSize')}: {formatBytes(originalSize)}</span>
              <span className="text-foreground">{t('newSize')}: {formatBytes(result.blob.size)}</span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                −{formatPercent(originalSize, result.blob.size)}
              </span>
            </>
          )}
          {originalSize === undefined && (
            <span className="text-foreground">{formatBytes(result.blob.size)}</span>
          )}
        </div>
        <DownloadButton blob={result.blob} filename={result.name} size="sm" className="w-full" />
      </div>
    </div>
  );
}

export function ResultPanel({ results, originalSize, onReset }: ResultPanelProps) {
  const t = useTranslations('toolShell');
  if (!results.length) return null;
  return (
    <div className="space-y-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-600 dark:text-emerald-400">✓</span>
        {t('resultTitle')}
      </h3>
      <div className={results.length > 1 ? 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3' : 'grid gap-4 sm:grid-cols-2'}>
        {results.map((r, i) => (
          <ResultCard key={`${r.name}-${i}`} result={r} originalSize={originalSize} index={i} />
        ))}
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t('processAnother')}
        </button>
      )}
    </div>
  );
}
