'use client';

import * as React from 'react';
import type { ProcessResult } from '@/lib/types';
import type { ProcessorOutput } from '@/lib/tools/processors';
import type { UploadError } from '@/components/tools/file-uploader';

export function useToolRunner() {
  const [processing, setProcessing] = React.useState(false);
  const [results, setResults] = React.useState<ProcessResult[]>([]);
  const [error, setError] = React.useState<UploadError | null>(null);
  /** Identity of the active run — a stale run must never overwrite results. */
  const runId = React.useRef(0);
  const inFlight = React.useRef(false);

  const run = React.useCallback(async (fn: () => Promise<ProcessorOutput>) => {
    // Guard against double-clicks / overlapping runs: while one run is in
    // flight the button is disabled, but a queued event must not start a
    // second concurrent encode whose late result could clobber the fresh one.
    if (inFlight.current) return;
    inFlight.current = true;
    const id = ++runId.current;
    setProcessing(true);
    setError(null);
    try {
      const out = await fn();
      if (id === runId.current) setResults(Array.isArray(out) ? out : [out]);
    } catch (e) {
      if (id === runId.current) {
        const msg = e instanceof Error ? e.message : 'generic';
        setError({ key: msg });
        setResults([]);
      }
    } finally {
      if (id === runId.current) setProcessing(false);
      inFlight.current = false;
    }
  }, []);

  const clear = React.useCallback(() => {
    // Invalidate any in-flight run so its late result is dropped.
    runId.current += 1;
    inFlight.current = false;
    setResults([]);
    setError(null);
  }, []);

  return { processing, results, error, run, clear, setError };
}
