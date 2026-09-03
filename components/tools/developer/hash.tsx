'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
import { HASH_ALGORITHMS, hasWebCrypto, hashBytes, hashText, type HashAlgorithm } from '@/lib/developer-tools';
import {
  CheckboxRow,
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  TextArea,
  ToggleGroup,
  ToolPanel,
  useDebounced,
} from '../kit';

type Hashes = Partial<Record<HashAlgorithm, string>>;

export default function HashGeneratorTool() {
  const t = useTranslations();
  const [mode, setMode] = React.useState<'text' | 'file'>('text');
  const [text, setText] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [hashes, setHashes] = React.useState<Hashes>({});
  const [uppercase, setUppercase] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [compareA, setCompareA] = React.useState('');
  const [compareB, setCompareB] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);

  const supported = typeof window !== 'undefined' ? hasWebCrypto() : true;
  const debouncedText = useDebounced(text, 300);

  React.useEffect(() => {
    if (mode !== 'text' || !supported) return;
    if (!debouncedText) {
      setHashes({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const entries = await Promise.all(
          HASH_ALGORITHMS.map(async (algo) => [algo, await hashText(debouncedText, algo)] as const),
        );
        if (!cancelled) setHashes(Object.fromEntries(entries));
      } catch {
        if (!cancelled) setError(t('errors.hashFailed'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedText, mode, supported, t]);

  const hashFile = async (selected: File | undefined) => {
    if (!selected) return;
    setFile(selected);
    setBusy(true);
    setError(null);
    try {
      // Read once into a buffer, hash all algorithms, then release it.
      let buffer: ArrayBuffer | null = await selected.arrayBuffer();
      const entries = await Promise.all(
        HASH_ALGORITHMS.map(async (algo) => [algo, await hashBytes(buffer as ArrayBuffer, algo)] as const),
      );
      buffer = null;
      setHashes(Object.fromEntries(entries));
    } catch {
      setError(t('errors.hashFailed'));
    } finally {
      setBusy(false);
    }
  };

  const display = (value: string) => (uppercase ? value.toUpperCase() : value);

  const comparison =
    compareA.trim() && compareB.trim()
      ? compareA.trim().toLowerCase() === compareB.trim().toLowerCase()
      : null;

  const reset = () => {
    setText('');
    setFile(null);
    setHashes({});
    setError(null);
  };

  if (!supported) {
    return <InlineError message={t('errors.noWebCrypto')} />;
  }

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('toolShell.settingsTitle')}
        actions={
          <>
            <ToggleGroup
              value={mode}
              onChange={(value) => {
                setMode(value);
                reset();
              }}
              options={[
                { value: 'text', label: t('dev.modeText') },
                { value: 'file', label: t('dev.modeFile') },
              ]}
            />
            <ResetButton onClick={reset} />
          </>
        }
      >
        {mode === 'text' ? (
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('textTools.typeOrPaste')}
            aria-label={t('textTools.input')}
            className="min-h-[160px] resize-y"
          />
        ) : (
          <>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              onChange={(e) => {
                void hashFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} loading={busy}>
              <Upload className="h-4 w-4" />
              {t('dev.chooseFile')}
            </Button>
            {file && (
              <p className="mt-2 text-sm text-muted-foreground">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}
          </>
        )}

        <div className="mt-3">
          <CheckboxRow checked={uppercase} onChange={setUppercase} label={t('dev.uppercase')} />
        </div>
      </ToolPanel>

      {error && <InlineError message={error} />}

      {Object.keys(hashes).length > 0 && (
        <ToolPanel title={t('dev.hashes')}>
          <ul className="space-y-2">
            {HASH_ALGORITHMS.map((algo) => {
              const value = hashes[algo];
              if (!value) return null;
              return (
                <li key={algo} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {algo}
                      {algo === 'SHA-1' && (
                        <span className="ms-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                          {t('dev.sha1Warning')}
                        </span>
                      )}
                    </span>
                    <CopyButton value={display(value)} size="icon-sm" variant="ghost" />
                  </div>
                  <code dir="ltr" className="mt-1.5 block break-all font-mono text-xs text-muted-foreground">
                    {display(value)}
                  </code>
                </li>
              );
            })}
          </ul>
        </ToolPanel>
      )}

      <ToolPanel title={t('dev.compareHashes')}>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextArea
            mono
            dir="ltr"
            value={compareA}
            onChange={(e) => setCompareA(e.target.value)}
            placeholder={t('dev.hashA')}
            aria-label={t('dev.hashA')}
            className="min-h-[80px]"
          />
          <TextArea
            mono
            dir="ltr"
            value={compareB}
            onChange={(e) => setCompareB(e.target.value)}
            placeholder={t('dev.hashB')}
            aria-label={t('dev.hashB')}
            className="min-h-[80px]"
          />
        </div>
        {comparison !== null && (
          <p
            className={`mt-3 text-sm font-semibold ${comparison ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}
          >
            {comparison ? t('dev.hashesMatch') : t('dev.hashesDiffer')}
          </p>
        )}
      </ToolPanel>

      <Notice>{t('dev.hashHint')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
