'use client';

import * as React from 'react';
import type { ProcessResult } from '@/lib/types';
import type { ProcessorOutput } from '@/lib/tools/processors';
import type { UploadError } from '@/components/tools/file-uploader';

export function useToolRunner() {
  const [processing, setProcessing] = React.useState(false);
  const [results, setResults] = React.useState<ProcessResult[]>([]);
  const [error, setError] = React.useState<UploadError | null>(null);
  // Monotonic id so a slow/stale pipeline can never clobber the result of a
  // newer run (double-click on the execute button, re-upload mid-process…).
  const runId = React.useRef(0);

  const run = React.useCallback(async (fn: () => Promise<ProcessorOutput>) => {
    const id = ++runId.current;
    setProcessing(true);
    setError(null);
    try {
      const out = await fn();
      if (runId.current !== id) return; // superseded by a newer run
      setResults(Array.isArray(out) ? out : [out]);
    } catch (e) {
      if (runId.current !== id) return;
      const msg = e instanceof Error ? e.message : 'generic';
      setError({ key: msg });
      setResults([]);
    } finally {
      if (runId.current === id) setProcessing(false);
    }
  }, []);

  const clear = React.useCallback(() => {
    runId.current += 1; // invalidate in-flight runs
    setResults([]);
    setError(null);
    setProcessing(false);
  }, []);

  return { processing, results, error, run, clear, setError };
}
