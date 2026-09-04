'use client';

/** Shared PDF tool building blocks: upload zone, info card, thumbnail grid. */

import * as React from 'react';
import { UploadCloud, FileText, X, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn, formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PdfError, inspect, readBytes, type PdfFileInfo } from '@/lib/pdf-processing';
import { openWithPdfJs, type LoadedPdf } from '@/lib/pdf-processing/render';

export function useErrorText() {
  const t = useTranslations();
  return React.useCallback(
    (error: unknown): string => {
      if (error instanceof PdfError) return t(`errors.${error.key}` as never);
      if (error instanceof Error && error.message) {
        const key = error.message;
        if (/^[a-zA-Z]+$/.test(key)) {
          try {
            return t(`errors.${key}` as never);
          } catch {
            /* fall through to generic */
          }
        }
      }
      return t('errors.generic');
    },
    [t],
  );
}

export interface PdfDropzoneProps {
  multiple?: boolean;
  maxFiles?: number;
  maxFileSizeMB: number;
  onFiles: (files: File[]) => void;
  onError: (message: string) => void;
  disabled?: boolean;
}

export function PdfDropzone({
  multiple = false,
  maxFiles = 1,
  maxFileSizeMB,
  onFiles,
  onError,
  disabled,
}: PdfDropzoneProps) {
  const t = useTranslations();
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const accept = async (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    if (files.length > maxFiles) {
      onError(t('validation.tooManyFiles', { max: maxFiles }));
      return;
    }
    for (const file of files) {
      if (!file.size) {
        onError(t('validation.emptyFile'));
        return;
      }
      if (file.size > maxFileSizeMB * 1024 * 1024) {
        onError(t('validation.fileTooLarge', { size: maxFileSizeMB }));
        return;
      }
      // Decide on the file's actual content, not on its name or the MIME type
      // the platform guessed. Downloads from messaging apps and scanners often
      // arrive without a `.pdf` extension or labelled `application/octet-stream`,
      // which used to be rejected before the real check ever ran.
      const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
      if (String.fromCharCode(...head.subarray(0, 4)) !== '%PDF') {
        onError(t('errors.invalidPdf'));
        return;
      }
    }
    onFiles(files);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={t('toolShell.clickOrDrag')}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) void accept(e.dataTransfer.files);
      }}
      className={cn(
        'flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 px-6 py-14 text-center transition-all duration-200',
        dragging && 'scale-[1.01] border-primary bg-accent/50',
        !disabled && 'hover:border-primary/50 hover:bg-accent/30',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <UploadCloud className={cn('mb-4 h-12 w-12 text-primary transition-transform', dragging && 'scale-110')} aria-hidden="true" />
      <p className="text-base font-medium text-foreground">{t('toolShell.dropHere')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('toolShell.clickOrDrag')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-2.5 py-1">{t('toolShell.maxSize', { n: maxFileSizeMB })}</span>
        {maxFiles > 1 && <span className="rounded-full bg-secondary px-2.5 py-1">{t('toolShell.maxFiles', { n: maxFiles })}</span>}
        <span className="rounded-full bg-secondary px-2.5 py-1">{t('toolShell.accepted', { formats: 'PDF' })}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) void accept(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

export function PdfInfoCard({
  info,
  onRemove,
  extra,
}: {
  info: PdfFileInfo;
  onRemove?: () => void;
  extra?: React.ReactNode;
}) {
  const t = useTranslations();
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
        <FileText className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground" title={info.name}>
          {info.name}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('pdfTools.pagesCount', { count: info.pageCount })} · {formatBytes(info.size)}
        </p>
        {extra}
      </div>
      {onRemove && (
        <Button variant="ghost" size="icon-sm" onClick={onRemove} aria-label={t('common.reset')}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/** Load a single PDF: validates, inspects and exposes the file + metadata. */
export function useSinglePdf() {
  const errorText = useErrorText();
  const [file, setFile] = React.useState<File | null>(null);
  const [info, setInfo] = React.useState<PdfFileInfo | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(
    async (files: File[]) => {
      const next = files[0];
      if (!next) return;
      setLoading(true);
      setError(null);
      try {
        const meta = await inspect(next);
        setFile(next);
        setInfo(meta);
      } catch (e) {
        setError(errorText(e));
        setFile(null);
        setInfo(null);
      } finally {
        setLoading(false);
      }
    },
    [errorText],
  );

  const reset = React.useCallback(() => {
    setFile(null);
    setInfo(null);
    setError(null);
  }, []);

  return { file, info, error, setError, loading, load, reset, errorText };
}

/** Render every page of a PDF to a thumbnail data URL (lazy, cancellable). */
export function usePageThumbnails(file: File | null, enabled = true, maxPages = 200) {
  const [thumbs, setThumbs] = React.useState<string[]>([]);
  const [rendering, setRendering] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const errorText = useErrorText();

  React.useEffect(() => {
    if (!file || !enabled) {
      setThumbs([]);
      return;
    }
    let cancelled = false;
    let doc: LoadedPdf | null = null;

    (async () => {
      setRendering(true);
      setError(null);
      setThumbs([]);
      setProgress(0);
      try {
        let bytes: Uint8Array | null = await readBytes(file);
        doc = await openWithPdfJs(bytes);
        bytes = null; // release the buffer reference early
        const total = Math.min(doc.numPages, maxPages);
        const out: string[] = [];
        for (let page = 1; page <= total; page += 1) {
          if (cancelled) return;
          out.push(await doc.renderThumb(page, 220));
          if (!cancelled) {
            setThumbs([...out]);
            setProgress(page);
          }
        }
      } catch (e) {
        if (!cancelled) setError(errorText(e));
      } finally {
        if (!cancelled) setRendering(false);
        await doc?.destroy().catch(() => undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, enabled, maxPages, errorText]);

  return { thumbs, rendering, progress, error };
}

export function ThumbnailSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="aspect-[3/4] animate-pulse rounded-lg border border-border bg-secondary/50" />
      ))}
    </div>
  );
}

export function RenderingIndicator({ done, total }: { done: number; total: number }) {
  const t = useTranslations();
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {t('pdfTools.renderingPages', { done, total })}
    </p>
  );
}

/** Download a set of blobs as one ZIP (JSZip is already a dependency). */
export async function downloadZip(files: { name: string; blob: Blob }[], zipName: string): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.blob);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  const { triggerDownload } = await import('@/lib/image/format');
  triggerDownload(blob, zipName);
}
