'use client';

import * as React from 'react';
import type { ProcessResult } from '@/lib/types';
import type { ProcessorOutput } from '@/lib/tools/processors';
import type { UploadError } from '@/components/tools/file-uploader';

export function useToolRunner() {
  const [processing, setProcessing] = React.useState(false);
  const [results, setResults] = React.useState<ProcessResult[]>([]);
  const [error, setError] = React.useState<UploadError | null>(null);

  const run = React.useCallback(async (fn: () => Promise<ProcessorOutput>) => {
    setProcessing(true);
    setError(null);
    try {
      const out = await fn();
      setResults(Array.isArray(out) ? out : [out]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'generic';
      setError({ key: msg });
      setResults([]);
    } finally {
      setProcessing(false);
    }
  }, []);

  const clear = React.useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return { processing, results, error, run, clear, setError };
}
