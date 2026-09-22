'use client';

import * as React from 'react';
import { UploadCloud, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ActionButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { DownloadButton } from '@/components/tools/download-button';
import { triggerDownload } from '@/lib/image/format';
import { assertValidOutput } from '@/lib/output-validation';
import { cn, formatBytes } from '@/lib/utils';
import {
  DEFAULT_RENAME_OPTIONS,
  applyPlan,
  planRename,
  type RenameOptions,
} from '@/lib/file-utils/rename';
import {
  CheckboxRow,
  Field,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  ToggleGroup,
  ToolPanel,
} from '../kit';

const MAX_FILES = 200;
const MAX_FILE_MB = 512;

/** Rename hundreds of files with prefixes, numbering and find/replace. */
export default function BulkRenamerTool() {
  const t = useTranslations();
  const [files, setFiles] = React.useState<File[]>([]);
  const [options, setOptions] = React.useState<RenameOptions>({ ...DEFAULT_RENAME_OPTIONS });
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [zipBlob, setZipBlob] = React.useState<Blob | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof RenameOptions>(key: K, value: RenameOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setZipBlob(null);
  };

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
      setZipBlob(null);
      setFiles((prev) => [...prev, ...incoming]);
    },
    [files.length, t],
  );

  const plan = React.useMemo(
    () => planRename(files.map((f) => ({ name: f.name, lastModified: f.lastModified })), options),
    [files, options],
  );
  const changed = plan.filter((p) => p.changed).length;

  const clear = () => {
    setFiles([]);
    setZipBlob(null);
    setError(null);
  };

  const downloadZip = async () => {
    if (!files.length) return;
    setBusy(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const renamed = applyPlan(files, plan);
      renamed.forEach((f) => zip.file(f.name, f));
      const blob = await zip.generateAsync({ type: 'blob' });
      await assertValidOutput(blob, { format: 'zip', minEntries: renamed.length, expectedFiles: renamed.map((file) => file.name) });
      setZipBlob(blob);
      await triggerDownload(blob, 'renamed-files.zip');
    } catch {
      setError(t('errors.zipFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <InlineError message={error} />

      <div
        role="button"
        tabIndex={0}
        aria-label={t('dev.renamerDrop')}
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
        <p className="text-sm font-medium text-foreground">{t('dev.renamerDrop')}</p>
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
        <>
          <StatGrid
            columns={3}
            items={[
              { label: t('dev.renamerFiles'), value: String(files.length) },
              { label: t('dev.renamerChanged'), value: String(changed), accent: true },
              {
                label: t('dev.renamerSize'),
                value: formatBytes(files.reduce((n, f) => n + f.size, 0)),
              },
            ]}
          />

          <ToolPanel title={t('dev.renamerRules')} actions={<ResetButton onClick={clear} />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('dev.renamerPrefix')}>
                <Input value={options.prefix} onChange={(e) => set('prefix', e.target.value)} maxLength={40} />
              </Field>
              <Field label={t('dev.renamerSuffix')}>
                <Input value={options.suffix} onChange={(e) => set('suffix', e.target.value)} maxLength={40} />
              </Field>
              <Field label={t('dev.renamerFind')}>
                <Input value={options.find} onChange={(e) => set('find', e.target.value)} maxLength={60} />
              </Field>
              <Field label={t('dev.renamerReplace')}>
                <Input value={options.replace} onChange={(e) => set('replace', e.target.value)} maxLength={60} />
              </Field>
              <Field label={t('dev.renamerRemove')}>
                <Input value={options.removeText} onChange={(e) => set('removeText', e.target.value)} maxLength={60} />
              </Field>
              <Field label={t('dev.renamerSpaces')}>
                <Select
                  value={options.spaceReplacement}
                  onChange={(e) => set('spaceReplacement', e.target.value)}
                  options={[
                    { value: '', label: t('dev.renamerSpacesKeep') },
                    { value: '-', label: 'dash (-)' },
                    { value: '_', label: 'underscore (_)' },
                    { value: '.', label: 'dot (.)' },
                  ]}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <ToggleGroup<RenameOptions['caseMode']>
                label={t('dev.renamerCase')}
                value={options.caseMode}
                onChange={(v) => set('caseMode', v)}
                options={[
                  { value: 'keep', label: t('dev.renamerCaseKeep') },
                  { value: 'lower', label: t('dev.renamerCaseLower') },
                  { value: 'upper', label: t('dev.renamerCaseUpper') },
                ]}
              />
              <div className="space-y-1">
                <CheckboxRow checked={options.numbering} onChange={(v) => set('numbering', v)} label={t('dev.renamerNumbering')} />
                <CheckboxRow checked={options.datePrefix} onChange={(v) => set('datePrefix', v)} label={t('dev.renamerDate')} />
              </div>
            </div>
            {options.numbering && (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Field label={t('dev.renamerStart')}>
                  <Input
                    type="number"
                    min={0}
                    max={999999}
                    value={options.startNumber}
                    onChange={(e) => set('startNumber', Number(e.target.value))}
                    dir="ltr"
                  />
                </Field>
                <Field label={t('dev.renamerPadding')}>
                  <Select
                    value={String(options.padding)}
                    onChange={(e) => set('padding', Number(e.target.value))}
                    options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: `${n} (${'1'.padStart(n, '0')})` }))}
                  />
                </Field>
                <Field label={t('dev.renamerPosition')}>
                  <Select
                    value={options.numberPosition}
                    onChange={(e) => set('numberPosition', e.target.value as 'suffix' | 'prefix')}
                    options={[
                      { value: 'suffix', label: t('dev.renamerPosSuffix') },
                      { value: 'prefix', label: t('dev.renamerPosPrefix') },
                    ]}
                  />
                </Field>
              </div>
            )}
          </ToolPanel>

          <ToolPanel
            title={t('dev.renamerPreview')}
            actions={
              <>
                <ActionButton onClick={downloadZip} disabled={busy || !files.length} processing={busy}>
                  {t('dev.renamerZip')}
                </ActionButton>
                <Button variant="ghost" size="sm" onClick={clear}>
                  {t('textTools.clear')}
                </Button>
              </>
            }
          >
            <ul className="max-h-[380px] divide-y divide-border overflow-y-auto">
              {plan.slice(0, 60).map((p) => (
                <li key={p.index} className="flex items-center gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate text-muted-foreground" title={p.original} dir="ltr">
                    {p.original}
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-muted-foreground">→</span>
                  <span
                    className={cn('min-w-0 flex-1 truncate font-medium', p.changed ? 'text-foreground' : 'text-muted-foreground')}
                    title={p.renamed}
                    dir="ltr"
                  >
                    {p.renamed}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== p.index))}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label={t('common.close')}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
            {plan.length > 60 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t('dev.renamerMore', { count: plan.length - 60 })}
              </p>
            )}
            <div className="mt-3">
              <Notice variant="info">{t('dev.renamerNote')}</Notice>
            </div>
            {zipBlob && (
              <div className="mt-3">
                <DownloadButton blob={zipBlob} filename="renamed-files.zip" />
              </div>
            )}
          </ToolPanel>
        </>
      )}
    </div>
  );
}
