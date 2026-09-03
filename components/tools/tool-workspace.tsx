'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { ToolDef } from '@/lib/tools/registry';
import type { FormatRule } from '@/lib/validation';
import { defaultRuleFor } from '@/lib/validation';
import type { DecodedImage } from '@/lib/types';
import { decodeImage } from '@/lib/image/format';
import { FileUploader, type UploadError } from './file-uploader';
import { ErrorDisplay } from './error-display';
import { ProcessingIndicator } from './processing-indicator';

export interface WorkspaceContext {
  decoded: DecodedImage[];
  files: File[];
  reset: () => void;
  setError: (error: UploadError | null) => void;
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

interface ToolWorkspaceProps {
  tool: ToolDef;
  rule: FormatRule;
  children: (ctx: WorkspaceContext) => React.ReactNode;
}

export function ToolWorkspace({ tool, rule, children }: ToolWorkspaceProps) {
  const t = useTranslations();
  const [files, setFiles] = React.useState<File[]>([]);
  const [decoded, setDecoded] = React.useState<DecodedImage[]>([]);
  const [decoding, setDecoding] = React.useState(false);
  const [error, setError] = React.useState<UploadError | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = React.useCallback(() => {
    decoded.forEach((d) => d.bitmap?.close());
    setFiles([]);
    setDecoded([]);
    setError(null);
    setBusy(false);
  }, [decoded]);

  // Decode files whenever the selection changes.
  React.useEffect(() => {
    if (!files.length) {
      setDecoded([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setDecoding(true);
      setError(null);
      try {
        const list = await Promise.all(files.map((f) => decodeImage(f)));
        if (!cancelled) setDecoded(list);
      } catch {
        if (!cancelled) {
          setError({ key: 'corruptImage' });
          setFiles([]);
        }
      } finally {
        if (!cancelled) setDecoding(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files]);

  const anyLarge = files.some((f) => f.size > 5 * 1024 * 1024);

  return (
    <div className="space-y-4">
      {error && (
        <ErrorDisplay
          error={error}
          onRetry={() => {
            setError(null);
            setFiles([]);
            setDecoded([]);
          }}
        />
      )}

      {!files.length && !decoding && (
        <FileUploader rule={rule} files={files} onFilesChange={setFiles} onError={setError} disabled={busy} />
      )}

      {decoding && <ProcessingIndicator />}

      {!decoding && files.length > 0 && decoded.length === files.length && (
        <>
          {anyLarge && (
            <p className="text-xs text-muted-foreground">⚠ {t('toolShell.noticeLarge')}</p>
          )}
          <FileUploader rule={rule} files={files} onFilesChange={setFiles} onError={setError} disabled={busy} />
          {children({ decoded, files, reset, setError, busy, setBusy })}
        </>
      )}
    </div>
  );
}

export function ruleFor(tool: ToolDef): FormatRule {
  return defaultRuleFor(tool.inputFormats, tool.maxFiles, tool.maxFileSizeMB);
}
