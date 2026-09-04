'use client';

import * as React from 'react';
import { UploadCloud, X, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FormatRule } from '@/lib/validation';
import { extensionOf, validateFile } from '@/lib/validation';
import { normalizeExt, normalizeMime } from '@/lib/image/format';
import { resolveUploadMessage } from './error-messages';
import { cn, formatBytes } from '@/lib/utils';

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

export function FileUploader({ rule, files, onFilesChange, onError, disabled, compact }: FileUploaderProps) {
  const t = useTranslations();
  const [dragging, setDragging] = React.useState(false);
  const dragCounter = React.useRef(0);
  const [thumbs, setThumbs] = React.useState<Record<number, string>>({});
  const [brokenThumbs, setBrokenThumbs] = React.useState<Record<number, boolean>>({});
  const inputRef = React.useRef<HTMLInputElement>(null);

  /**
   * `accept` for the hidden input.
   *
   * Never a strict MIME-only list: on iOS/Android that hides valid photos whose
   * reported type is missing or non-standard (HEIC from the camera roll, images
   * shared from WhatsApp/Drive, screenshots without an extension). Falls back to
   * `image/*` for image tools and to PDF tokens for the PDF-only tools.
   */
  const acceptAttr = React.useMemo(() => {
    if (rule.accept) return rule.accept;
    if (rule.acceptsImages === false) return 'application/pdf,.pdf';
    const mimes = (rule.mimes || []).filter((m) => m && m !== 'application/octet-stream');
    return ['image/*', ...mimes].join(',');
  }, [rule]);

  // Manage object URLs for thumbnails.
  React.useEffect(() => {
    const urls: string[] = [];
    const map: Record<number, string> = {};
    files.forEach((file, i) => {
      // Trust more than the MIME type: phones often hand over an empty one, and
      // HEIC previews simply fail to render — that is handled by onError below.
      const isPdf =
        normalizeExt(extensionOf(file.name)) === 'pdf' ||
        normalizeMime(file.type) === 'application/pdf';
      if (!isPdf) {
        const url = URL.createObjectURL(file);
        urls.push(url);
        map[i] = url;
      }
    });
    setThumbs(map);
    setBrokenThumbs({});
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const handleFiles = async (incoming: FileList | File[]) => {
    if (disabled) return;
    const list = Array.from(incoming);
    if (!list.length) return;

    // Keep whatever still fits instead of throwing the whole batch away.
    const room = Math.max(0, rule.maxFiles - files.length);
    if (room === 0) {
      onError({ key: 'tooManyFiles', params: { max: String(rule.maxFiles) } });
      return;
    }
    const batch = list.slice(0, room);
    const truncated = list.length > batch.length;

    const accepted: File[] = [];
    let firstError: UploadError | null = null;
    for (const file of batch) {
      const result = await validateFile(file, rule);
      if (result.valid) {
        accepted.push(file);
      } else if (!firstError) {
        firstError = { key: result.errorKey!, params: result.params };
      }
    }
    // Everything the user picked that did not make it into the list.
    const skipped = list.length - accepted.length;

    // Add every file that passed, then surface one honest message about the rest.
    if (accepted.length) onFilesChange([...files, ...accepted]);
    if (accepted.length && skipped > 0) {
      // Some files made it in — explain what was skipped instead of blocking.
      const reason = firstError
        ? resolveUploadMessage(firstError, t)
        : t('validation.tooManyFiles', { max: String(rule.maxFiles) });
      onError({ key: 'partialSkip', params: { count: String(skipped), reason } });
      return;
    }
    if (truncated && !firstError) {
      firstError = { key: 'tooManyFiles', params: { max: String(rule.maxFiles) } };
    }
    if (firstError) onError(firstError);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeAt = (i: number) => {
    onFilesChange(files.filter((_, idx) => idx !== i));
  };

  if (files.length > 0) {
    return (
      <div
        className={cn('space-y-3 rounded-xl transition-shadow', dragging && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) {
            dragCounter.current += 1;
            setDragging(true);
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          dragCounter.current = Math.max(0, dragCounter.current - 1);
          if (dragCounter.current === 0) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              className="group relative overflow-hidden rounded-lg border border-border bg-secondary/40"
            >
              <div className="aspect-square w-full overflow-hidden bg-secondary">
                {thumbs[i] && !brokenThumbs[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbs[i]}
                    alt={file.name}
                    className="h-full w-full object-cover"
                    onError={() => setBrokenThumbs((prev) => ({ ...prev, [i]: true }))}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
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
