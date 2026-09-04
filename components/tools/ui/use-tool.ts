'use client';

import * as React from 'react';
import type { ProcessResult } from '@/lib/types';
import type { ProcessorOutput } from '@/lib/tools/processors';
import type { UploadError } from '@/components/tools/file-uploader';

export function useToolRunner() {
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState<number | undefined>(undefined);
  const [progressText, setProgressText] = React.useState<string | undefined>(undefined);
  const [results, setResults] = React.useState<ProcessResult[]>([]);
  const [error, setError] = React.useState<UploadError | null>(null);

  const run = React.useCallback(async (fn: (updateProgress?: (percent: number, text?: string) => void) => Promise<ProcessorOutput>) => {
    setProcessing(true);
    setError(null);
    setProgress(undefined);
    setProgressText(undefined);
    try {
      const out = await fn((p, text) => {
        setProgress(p);
        if (text) setProgressText(text);
      });
      setResults(Array.isArray(out) ? out : [out]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'generic';
      setError({ key: msg });
      setResults([]);
    } finally {
      setProcessing(false);
      setProgress(undefined);
      setProgressText(undefined);
    }
  }, []);

  const clear = React.useCallback(() => {
    setResults([]);
    setError(null);
    setProgress(undefined);
    setProgressText(undefined);
  }, []);

  return { processing, progress, progressText, results, error, run, clear, setError, setResults };
}
