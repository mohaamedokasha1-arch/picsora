'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, Sparkles } from 'lucide-react';
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
  const [progressInfo, setProgressInfo] = React.useState<{ current: number; total: number; percent: number } | null>(null);
  const [error, setError] = React.useState<UploadError | null>(null);
  const [busy, setBusy] = React.useState(false);

  const reset = React.useCallback(() => {
    decoded.forEach((d) => {
      d.bitmap?.close();
    });
    setFiles([]);
    setDecoded([]);
    setError(null);
    setBusy(false);
    setProgressInfo(null);
  }, [decoded]);

  // Decode files sequentially to prevent browser freezing & OOM
  React.useEffect(() => {
    if (!files.length) {
      setDecoded([]);
      setProgressInfo(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDecoding(true);
      setError(null);
      const list: DecodedImage[] = [];

      try {
        for (let i = 0; i < files.length; i++) {
          if (cancelled) return;
          const file = files[i];
          setProgressInfo({
            current: i + 1,
            total: files.length,
            percent: Math.round(((i + 1) / files.length) * 100),
          });

          const item = await decodeImage(file);
          list.push(item);
        }

        if (!cancelled) {
          setDecoded(list);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const errObj = err as { message?: string };
          const errKey =
            errObj.message === 'dimensions-too-large'
              ? 'dimensions-too-large'
              : errObj.message === 'file-too-large'
                ? 'file-too-large'
                : errObj.message === 'heic-conversion-failed'
                  ? 'heic-conversion-failed'
                  : 'corruptImage';

          setError({ key: errKey });
          setFiles([]);
          setDecoded([]);
        }
      } finally {
        if (!cancelled) {
          setDecoding(false);
          setProgressInfo(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files]);

  const anyLarge = files.some((f) => f.size > 5 * 1024 * 1024);
  const hasLivePhoto = decoded.some((d) => d.isLivePhoto);

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

      {hasLivePhoto && (
        <div className="flex items-center gap-2.5 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
          <Camera className="h-4 w-4 text-primary shrink-0" />
          <span>{t('toolShell.livePhotoDetected')}</span>
        </div>
      )}

      {!files.length && !decoding && (
        <FileUploader rule={rule} files={files} onFilesChange={setFiles} onError={setError} disabled={busy} />
      )}

      {decoding && (
        <ProcessingIndicator
          current={progressInfo?.current}
          total={progressInfo?.total}
          progress={progressInfo?.percent}
        />
      )}

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
