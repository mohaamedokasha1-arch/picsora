'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { ToolDef } from '@/lib/tools/registry';
import type { FormatRule } from '@/lib/validation';
import { defaultRuleFor, isHeifFile } from '@/lib/validation';
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
  /** Decode / processing errors. */
  const [error, setError] = React.useState<UploadError | null>(null);
  /**
   * Upload validation notices ("too many files", "this type is not supported").
   * Kept separate so a successful decode of the *other* files never erases the
   * explanation of why one file was skipped.
   */
  const [uploadError, setUploadError] = React.useState<UploadError | null>(null);
  const [busy, setBusy] = React.useState(false);
  /** Set when we prune undecodable files ourselves, to avoid a decode loop. */
  const skipNextDecode = React.useRef(false);

  const reset = React.useCallback(() => {
    decoded.forEach((d) => d.bitmap?.close());
    setFiles([]);
    setDecoded([]);
    setError(null);
    setUploadError(null);
    setBusy(false);
  }, [decoded]);

  // Decode files whenever the selection changes. Each file is decoded on its own
  // so a single unreadable photo (an iPhone HEIC in a browser without HEIF
  // support, a truncated download, …) no longer throws away the whole batch.
  React.useEffect(() => {
    if (!files.length) {
      skipNextDecode.current = false;
      setDecoded([]);
      setUploadError(null);
      return;
    }
    if (skipNextDecode.current) {
      skipNextDecode.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      setDecoding(true);
      setError(null);
      const settled = await Promise.all(
        files.map(async (file) => {
          try {
            return { file, image: await decodeImage(file) };
          } catch {
            return { file, image: null as DecodedImage | null };
          }
        }),
      );
      if (cancelled) {
        settled.forEach((s) => s.image?.bitmap?.close());
        return;
      }
      const good = settled.filter((s) => s.image).map((s) => s.image as DecodedImage);
      const bad = settled.filter((s) => !s.image).map((s) => s.file);
      setDecoded(good);
      setDecoding(false);
      if (bad.length) {
        // Honest, specific message instead of a generic "unsupported" error.
        const heif = await isHeifFile(bad[0]).catch(() => false);
        if (!cancelled) {
          setError({
            key: heif ? 'heicUnsupported' : 'corruptImage',
            params: { count: bad.length },
          });
          // Keep the readable files; prune only the ones the browser cannot open.
          skipNextDecode.current = true;
          setFiles(good.map((d) => d.file));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [files]);

  const anyLarge = files.some((f) => f.size > 5 * 1024 * 1024);
  const activeError = uploadError ?? error;

  return (
    <div className="space-y-4">
      {activeError && (
        <ErrorDisplay
          error={activeError}
          onRetry={() => {
            setError(null);
            setUploadError(null);
            setFiles([]);
            setDecoded([]);
          }}
        />
      )}

      {!files.length && !decoding && (
        <FileUploader
          rule={rule}
          files={files}
          onFilesChange={setFiles}
          onError={setUploadError}
          disabled={busy}
        />
      )}

      {decoding && <ProcessingIndicator />}

      {!decoding && decoded.length > 0 && (
        <>
          {anyLarge && (
            <p className="text-xs text-muted-foreground">⚠ {t('toolShell.noticeLarge')}</p>
          )}
          <FileUploader
            rule={rule}
            files={files}
            onFilesChange={setFiles}
            onError={setUploadError}
            disabled={busy}
          />
          {children({ decoded, files, reset, setError, busy, setBusy })}
        </>
      )}
    </div>
  );
}

export function ruleFor(tool: ToolDef): FormatRule {
  return defaultRuleFor(tool.inputFormats, tool.maxFiles, tool.maxFileSizeMB);
}
