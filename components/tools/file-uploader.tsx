'use client';

import * as React from 'react';
import { UploadCloud, X, ImageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { FormatRule } from '@/lib/validation';
import { validateFile } from '@/lib/validation';
import { canonicalFormatFromExt, canonicalFormatFromMime, fileExt, isImageExt, isImageMime } from '@/lib/image/format';
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
  const [notice, setNotice] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  /**
   * Whether a file is worth previewing.
   *
   * `file.type` is empty for a surprising number of mobile picks, so the old
   * `type.startsWith('image/')` test silently dropped those thumbnails. The
   * extension and the rule are used as extra signals instead.
   */
  const isPreviewable = React.useCallback(
    (file: File) => {
      const ext = fileExt(file.name);
      if (canonicalFormatFromMime(file.type) === 'pdf' || canonicalFormatFromExt(ext) === 'pdf') return false;
      if (isImageMime(file.type) || isImageExt(ext)) return true;
      // Unknown or generic MIME (very common on phones): preview unless this is
      // a PDF-only tool, where the file is almost certainly a document.
      return !rule.extensions.some((e) => canonicalFormatFromExt(e) === 'pdf');
    },
    [rule.extensions],
  );

  // Manage object URLs for thumbnails.
  React.useEffect(() => {
    const urls: string[] = [];
    const map: Record<number, string> = {};
    files.forEach((file, i) => {
      if (isPreviewable(file)) {
        const url = URL.createObjectURL(file);
        urls.push(url);
        map[i] = url;
      }
    });
    setThumbs(map);
    setBrokenThumbs({});
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files, isPreviewable]);

  const handleFiles = async (incoming: FileList | File[]) => {
    if (disabled) return;
    let list = Array.from(incoming).filter(Boolean);
    if (!list.length) return;

    const room = rule.maxFiles - files.length;
    if (room <= 0) {
      // Shown as an inline notice rather than an error banner: nothing was
      // lost or rejected, the tool is simply full.
      setNotice(t('validation.tooManyFiles', { max: rule.maxFiles }));
      return;
    }
    if (list.length > room) {
      // Keep what fits rather than discarding the whole selection — phone
      // galleries make it easy to pick 30 photos for a 20-file tool.
      list = list.slice(0, room);
      setNotice(t('validation.tooManyFiles', { max: rule.maxFiles }));
    } else {
      setNotice(null);
    }

    const accepted: File[] = [];
    let firstError: UploadError | null = null;
    for (const file of list) {
      const result = await validateFile(file, rule);
      if (result.valid) {
        accepted.push(file);
      } else if (!firstError) {
        firstError = { key: result.errorKey || 'invalidType', params: result.params };
      }
    }

    if (accepted.length) {
      onFilesChange([...files, ...accepted]);
    }
    // Only surface a rejection when nothing at all got through. Otherwise one
    // bad file in a batch would hide behind a banner whose "try again" button
    // clears the images the user did manage to upload.
    if (firstError && !accepted.length) {
      onError(firstError);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Snapshot before clearing: resetting `value` empties the FileList, and
    // some mobile browsers invalidate it immediately.
    const picked = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (picked.length) void handleFiles(picked);
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
                className="absolute end-1.5 top-1.5 rounded-md bg-black/60 p-1 text-white opacity-100 transition-opacity focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
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
          accept={rule.accept}
          className="sr-only"
          onChange={onInputChange}
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
      {notice && <p className="mt-3 text-xs text-muted-foreground">{notice}</p>}
      <input
        ref={inputRef}
        type="file"
        multiple={rule.maxFiles > 1}
        accept={rule.accept}
        className="sr-only"
        onChange={onInputChange}
      />
    </div>
  );
}
