'use client';

import * as React from 'react';
import { UploadCloud } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { hashBytes } from '@/lib/developer-tools';
import { cn, formatBytes } from '@/lib/utils';
import { InlineError, Notice, PrivacyNotice, ProgressBar, ResetButton, StatGrid, ToolPanel } from '../kit';

const MAX_FILES = 200;
const MAX_FILE_MB = 512;

interface DuplicateGroup {
  hash: string;
  size: number;
  files: string[];
}

/** Find byte-identical duplicate files by SHA-256 content hashing. */
export default function DuplicateFinderTool() {
  const t = useTranslations();
  const [files, setFiles] = React.useState<File[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [groups, setGroups] = React.useState<DuplicateGroup[] | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cancelled = React.useRef(false);

  React.useEffect(() => () => {
    cancelled.current = true;
  }, []);

  const accept = React.useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list);
      if (!incoming.length) return;
      if (files.length + incoming.length > MAX_FILES) {
        setError(t('validation.tooManyFiles', { max: MAX_FILES }));
        return;
      }
      for (const f of incoming) {
        if (f.size > MAX_FILE_MB * 1024 * 1024) {
          setError(t('validation.fileTooLarge', { size: MAX_FILE_MB }));
          return;
        }
      }
      setError(null);
      setGroups(null);
      setFiles((prev) => [...prev, ...incoming]);
    },
    [files.length, t],
  );

  const clear = () => {
    cancelled.current = true;
    setFiles([]);
    setGroups(null);
    setError(null);
    setProgress({ done: 0, total: 0 });
  };

  const scan = async () => {
    if (!files.length || busy) return;
    cancelled.current = false;
    setBusy(true);
    setError(null);
    setGroups(null);
    try {
      // Group by size first: files with a unique size cannot be duplicates,
      // so most files never need hashing at all.
      const bySize = new Map<number, File[]>();
      for (const f of files) {
        const list = bySize.get(f.size) ?? [];
        list.push(f);
        bySize.set(f.size, list);
      }
      const candidates = [...bySize.values()].filter((list) => list.length > 1).flat();
      const byHash = new Map<string, File[]>();
      for (let i = 0; i < candidates.length; i += 1) {
        if (cancelled.current) return;
        const f = candidates[i];
        setProgress({ done: i, total: candidates.length });
        let buffer: ArrayBuffer | null = await f.arrayBuffer();
        try {
          const hash = await hashBytes(buffer, 'SHA-256');
          const list = byHash.get(hash) ?? [];
          list.push(f);
          byHash.set(hash, list);
        } finally {
          buffer = null;
        }
        // Yield so the progress bar paints on huge batches.
        if (i % 4 === 3) await new Promise((r) => window.setTimeout(r, 0));
      }
      setProgress({ done: candidates.length, total: candidates.length });
      const dupes: DuplicateGroup[] = [];
      for (const [hash, list] of byHash) {
        if (list.length > 1) {
          dupes.push({ hash, size: list[0].size, files: list.map((f) => f.name) });
        }
      }
      dupes.sort((a, b) => b.size * (b.files.length - 1) - a.size * (a.files.length - 1));
      setGroups(dupes);
    } catch {
      setError(t('errors.hashFailed'));
    } finally {
      setBusy(false);
    }
  };

  const wasted = groups ? groups.reduce((n, g) => n + g.size * (g.files.length - 1), 0) : 0;
  const dupeFiles = groups ? groups.reduce((n, g) => n + g.files.length - 1, 0) : 0;

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      <div
        role="button"
        tabIndex={0}
        aria-label={t('dev.dupeDrop')}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files);
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
          dragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40',
        )}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">{t('dev.dupeDrop')}</p>
        <p className="text-xs text-muted-foreground">{t('dev.renamerAnyFile')}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            accept(e.target.files ?? []);
            e.target.value = '';
          }}
        />
      </div>

      {files.length > 0 && (
        <ToolPanel title={t('dev.dupeFiles', { count: files.length })} actions={<ResetButton onClick={clear} />}>
          <div className="space-y-3">
            <Notice variant="info">{t('dev.dupeHint')}</Notice>
            {busy && <ProgressBar value={progress.done} max={Math.max(1, progress.total)} />}
            <ActionButton onClick={scan} disabled={busy || files.length < 2} processing={busy} className="w-full sm:w-auto">
              {t('dev.dupeAction')}
            </ActionButton>
          </div>
        </ToolPanel>
      )}

      {groups !== null && !busy && (
        <>
          <StatGrid
            columns={3}
            items={[
              { label: t('dev.dupeGroups'), value: String(groups.length), accent: true },
              { label: t('dev.dupeFilesCount'), value: String(dupeFiles) },
              { label: t('dev.dupeWasted'), value: formatBytes(wasted) },
            ]}
          />
          <ToolPanel title={t('pdfTools.results')} actions={<ResetButton onClick={clear} />}>
            {groups.length === 0 ? (
              <Notice variant="privacy">{t('dev.dupeNone')}</Notice>
            ) : (
              <ul className="space-y-4">
                {groups.map((g) => (
                  <li key={g.hash} className="rounded-lg border border-border p-3">
                    <p className="text-xs text-muted-foreground" dir="ltr">
                      SHA-256 <span className="font-mono">{g.hash.slice(0, 16)}…</span> · {formatBytes(g.size)} ·{' '}
                      {t('dev.dupeCopies', { count: g.files.length })}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {g.files.map((name, i) => (
                        <li key={i} dir="ltr" className="truncate rounded bg-secondary/50 px-2 py-1 font-mono text-xs text-foreground" title={name}>
                          {name}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </ToolPanel>
        </>
      )}
    </div>
  );
}
