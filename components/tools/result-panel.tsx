'use client';

import * as React from 'react';
import { FileText, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProcessResult } from '@/lib/types';
import { formatBytes, formatSizeChange } from '@/lib/utils';
import { formatLabel } from '@/lib/image/format-support';
import { DownloadButton } from './download-button';
import { FormatFallbackNotice } from './ui/format-support';

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
  const [dims, setDims] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    if (!isImage(result)) return;
    setDims(null);
    const u = URL.createObjectURL(result.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [result]);

  // Per-result original size wins: batch tools (compressor, converter,
  // exact-KB) compare each output against ITS OWN source, not the batch sum.
  const orig = result.originalSize ?? originalSize;
  const change = orig !== undefined ? formatSizeChange(orig, result.blob.size) : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-secondary/40">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={result.name}
            className="h-full w-full object-contain"
            onLoad={(e) => {
              const el = e.currentTarget;
              if (el.naturalWidth > 0) setDims({ w: el.naturalWidth, h: el.naturalHeight });
            }}
          />
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
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-xs text-muted-foreground" title={result.name}>
            {result.name}
          </div>
          {dims && (
            <div className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
              {dims.w} × {dims.h} px
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {orig !== undefined && (
            <>
              <span className="text-muted-foreground line-through">{t('originalSize')}: {formatBytes(orig)}</span>
              <span className="text-foreground">{t('newSize')}: {formatBytes(result.blob.size)}</span>
              {change && (
                <span
                  className={
                    change.kind === 'saved'
                      ? 'rounded bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400'
                      : change.kind === 'grew'
                        ? 'rounded bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-600 dark:text-amber-400'
                        : 'rounded bg-secondary px-1.5 py-0.5 font-semibold text-muted-foreground'
                  }
                >
                  {change.text}
                </span>
              )}
            </>
          )}
          {orig === undefined && (
            <span className="text-foreground">{formatBytes(result.blob.size)}</span>
          )}
          {result.fallbackFrom && (
            // The requested container could not be written by this browser and
            // the encoder substituted a safe one: say so on the card itself,
            // because the file is valid and the user must not think it failed.
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-700 dark:text-amber-300">
              {formatLabel(result.fallbackFrom)} → {formatLabel(result.format)}
            </span>
          )}
          {typeof result.finalQuality === 'number' && ['jpg', 'jpeg', 'webp'].includes(result.format) && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
              {t('usedQuality')}: {result.finalQuality}%
            </span>
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
      {/* Honest note whenever the encoder had to substitute a container: the
          files below are valid, and the user is told what they actually are. */}
      <FormatFallbackNotice results={results} />
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
