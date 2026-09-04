'use client';

import * as React from 'react';
import { UploadCloud, X, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FormatRule } from '@/lib/validation';
import { validateFiles } from '@/lib/validation';
import { cn, formatBytes } from '@/lib/utils';
import { convertHeicToBlob } from '@/lib/image/heic';

export interface UploadError {
  key: string;
  params?: Record<string, string | number>;
}

interface FileUploaderProps {
  rule: FormatRule;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onError: (error: UploadError) => void;
  disabled?: boolean;
  compact?: boolean;
}

function isHeicName(file: File): boolean {
  return /\.hei[cf]$/i.test(file.name) || file.type.toLowerCase().includes('heic') || file.type.toLowerCase().includes('heif');
}

/** Thumbnail that converts HEIC previews locally so iPhone photos show up. */
function Thumb({ file }: { file: File }) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const revoke = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
    };
    (async () => {
      try {
        let blob: Blob | null = null;
        if (isHeicName(file)) {
          blob = await convertHeicToBlob(file, 'image/jpeg', 0.7);
        } else if (file.type.startsWith('image/')) {
          blob = file;
        } else {
          return;
        }
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      } catch {
        /* keep the generic icon — the workspace will explain */
      }
    })();
    return () => {
      cancelled = true;
      revoke();
    };
  }, [file]);

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={file.name} className="h-full w-full object-cover" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
      <ImageIcon className="h-6 w-6" />
    </div>
  );
}

export function FileUploader({ rule, files, onFilesChange, onError, disabled, compact }: FileUploaderProps) {
  const t = useTranslations();
  const [dragging, setDragging] = React.useState(false);
  const dragCounter = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // MIME list plus explicit extensions: some mobile browsers report odd MIME
  // types for HEIC, so the `.heic` fallback keeps the picker honest.
  const acceptAttr = React.useMemo(() => {
    const exts = rule.extensions.map((e) => `.${e}`);
    return [...rule.mimes, ...exts].join(',');
  }, [rule]);

  const handleFiles = async (incoming: FileList | File[]) => {
    if (disabled) return;
    const list = Array.from(incoming);
    if (!list.length) return;
    if (files.length + list.length > rule.maxFiles) {
      onError({ key: 'tooManyFiles', params: { max: String(rule.maxFiles) } });
      return;
    }
    // Batch validation: per-file checks (name structure, magic bytes, MIME,
    // SVG active content) plus the combined-size ceiling. Same error keys as
    // before, so the messages the user sees are unchanged.
    const result = await validateFiles([...files, ...list], rule);
    if (!result.valid) {
      onError({
        key: result.errorKey!,
        params: { ...result.params, ...(result.file ? { file: result.file } : {}) },
      });
      return; // stop on first invalid file to keep it simple
    }
    onFilesChange([...files, ...list]);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    if (disabled || !e.clipboardData?.files.length) return;
    e.preventDefault();
    handleFiles(e.clipboardData.files);
  };

  const removeAt = (i: number) => {
    onFilesChange(files.filter((_, idx) => idx !== i));
  };

  if (files.length > 0) {
    return (
      <div className="space-y-3">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="group relative overflow-hidden rounded-lg border border-border bg-secondary/40"
            >
              <div className="aspect-square w-full overflow-hidden bg-secondary">
                <Thumb file={file} />
              </div>
              <div className="truncate px-2 py-1.5 text-xs text-muted-foreground" title={file.name}>
                {file.name} · {formatBytes(file.size)}
              </div>
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`${t('common.close')} — ${file.name}`}
                className="absolute end-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {files.length < rule.maxFiles && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
          >
            + {t('toolShell.uploadTitle')}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple={rule.maxFiles > 1}
          accept={acceptAttr}
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
    );
  }

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
      onPaste={onPaste}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
          dragCounter.current += 1;
          setDragging(true);
        }
      }}
      onDragLeave={(e: React.DragEvent) => {
        e.stopPropagation();
        dragCounter.current = Math.max(0, dragCounter.current - 1);
        if (dragCounter.current === 0) setDragging(false);
      }}
      onDrop={onDrop}
      className={cn(
        'flex w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border bg-secondary/30 px-6 text-center transition-all duration-200',
        compact ? 'py-10' : 'py-16',
        dragging && 'border-primary bg-accent/50 scale-[1.01]',
        !disabled && 'hover:border-primary/50 hover:bg-accent/30',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <UploadCloud
        className={cn('mb-4 h-12 w-12 text-primary transition-transform duration-200', dragging && 'scale-110')}
        aria-hidden="true"
      />
      <p className="text-base font-medium text-foreground">{t('toolShell.dropHere')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('toolShell.clickOrDrag')}</p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-2.5 py-1">{t('toolShell.maxSize', { n: rule.maxFileSizeMB })}</span>
        {rule.maxFiles > 1 && (
          <span className="rounded-full bg-secondary px-2.5 py-1">{t('toolShell.maxFiles', { n: rule.maxFiles })}</span>
        )}
        <span className="rounded-full bg-secondary px-2.5 py-1">{t('toolShell.accepted', { formats: rule.label })}</span>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple={rule.maxFiles > 1}
        accept={acceptAttr}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
