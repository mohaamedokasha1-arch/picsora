'use client';

import * as React from 'react';
import { Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
import { triggerDownload } from '@/lib/image/format';
import { base64ToBytes, base64ToUtf8, bytesToBase64, isValidBase64, mimeFromDataUri, utf8ToBase64 } from '@/lib/developer-tools';
import {
  CheckboxRow,
  CopyButton,
  InlineError,
  PrivacyNotice,
  ResetButton,
  TextArea,
  ToggleGroup,
  ToolPanel,
} from '../kit';

type Mode = 'text' | 'file' | 'image';

const MAX_MB = 25;

export default function Base64Tool() {
  const t = useTranslations();
  const [mode, setMode] = React.useState<Mode>('text');
  const [operation, setOperation] = React.useState<'encode' | 'decode'>('encode');
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [wrap, setWrap] = React.useState(true);
  const [fileName, setFileName] = React.useState('');
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  // Text mode transforms live.
  React.useEffect(() => {
    if (mode !== 'text') return;
    if (!input) {
      setOutput('');
      setError(null);
      return;
    }
    try {
      if (operation === 'encode') {
        setOutput(utf8ToBase64(input));
        setError(null);
      } else {
        if (!isValidBase64(input)) {
          setOutput('');
          setError(t('errors.invalidBase64'));
          return;
        }
        setOutput(base64ToUtf8(input));
        setError(null);
      }
    } catch {
      setOutput('');
      setError(t('errors.invalidBase64'));
    }
  }, [input, operation, mode, t]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(t('validation.fileTooLarge', { size: MAX_MB }));
      return;
    }
    setError(null);
    setFileName(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = bytesToBase64(bytes);
    const type = file.type || 'application/octet-stream';
    setOutput(mode === 'image' ? `data:${type};base64,${base64}` : base64);
    if (mode === 'image') {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const decodeToFile = () => {
    try {
      const bytes = base64ToBytes(input);
      const type = mimeFromDataUri(input) ?? 'application/octet-stream';
      const blob = new Blob([bytes.slice().buffer as ArrayBuffer], { type });
      if (mode === 'image') {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(URL.createObjectURL(blob));
        setError(null);
      } else {
        triggerDownload(blob, fileName || 'decoded-file');
        setError(null);
      }
    } catch {
      setError(t('errors.invalidBase64'));
    }
  };

  const reset = () => {
    setInput('');
    setOutput('');
    setError(null);
    setFileName('');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const detectedMime = mode !== 'text' ? mimeFromDataUri(input || output) : null;

  return (
    <div className="space-y-5">
      <ToolPanel title={t('toolShell.settingsTitle')} actions={<ResetButton onClick={reset} />}>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleGroup
            label={t('dev.mode')}
            value={mode}
            onChange={(value) => {
              setMode(value);
              reset();
            }}
            options={[
              { value: 'text', label: t('dev.modeText') },
              { value: 'file', label: t('dev.modeFile') },
              { value: 'image', label: t('dev.modeImage') },
            ]}
          />
          <ToggleGroup
            label={t('dev.operation')}
            value={operation}
            onChange={(value) => {
              setOperation(value);
              reset();
            }}
            options={[
              { value: 'encode', label: t('dev.encode') },
              { value: 'decode', label: t('dev.decode') },
            ]}
          />
        </div>
      </ToolPanel>

      {error && <InlineError message={error} />}

      {mode === 'text' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ToolPanel title={t('textTools.input')}>
            <TextArea
              mono
              dir="ltr"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={operation === 'encode' ? 'Hello, world!' : 'SGVsbG8sIHdvcmxkIQ=='}
              aria-label={t('textTools.input')}
              className="min-h-[220px] resize-y"
            />
          </ToolPanel>
          <ToolPanel title={t('textTools.output')} actions={<CopyButton value={output} />}>
            <TextArea
              mono
              dir="ltr"
              readOnly
              value={output}
              aria-label={t('textTools.output')}
              className={`min-h-[220px] resize-y bg-secondary/30 ${wrap ? '' : 'whitespace-pre'}`}
            />
            <div className="mt-2">
              <CheckboxRow checked={wrap} onChange={setWrap} label={t('dev.lineWrap')} />
            </div>
          </ToolPanel>
        </div>
      )}

      {mode !== 'text' && operation === 'encode' && (
        <ToolPanel title={mode === 'image' ? t('dev.uploadImage') : t('dev.uploadFile')}>
          <input
            ref={fileRef}
            type="file"
            accept={mode === 'image' ? 'image/*' : undefined}
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {t('dev.chooseFile')}
          </Button>
          {fileName && <p className="mt-2 text-sm text-muted-foreground">{fileName}</p>}

          {previewUrl && mode === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={fileName} className="mt-3 max-h-56 rounded-lg border border-border" />
          )}

          {output && (
            <div className="mt-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CopyButton value={output} />
                <span className="text-xs text-muted-foreground">{formatBytes(output.length)}</span>
                {detectedMime && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                    {detectedMime}
                  </span>
                )}
              </div>
              <TextArea
                mono
                dir="ltr"
                readOnly
                value={output}
                aria-label={t('textTools.output')}
                className="min-h-[180px] resize-y bg-secondary/30"
              />
            </div>
          )}
        </ToolPanel>
      )}

      {mode !== 'text' && operation === 'decode' && (
        <ToolPanel title={t('dev.pasteBase64')}>
          <TextArea
            mono
            dir="ltr"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="data:image/png;base64,iVBORw0KGgo…"
            aria-label={t('dev.pasteBase64')}
            className="min-h-[180px] resize-y"
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={decodeToFile} disabled={!input}>
              {mode === 'image' ? t('dev.previewImage') : t('dev.downloadFile')}
            </Button>
            {detectedMime && (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                {detectedMime}
              </span>
            )}
          </div>
          {previewUrl && mode === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className="mt-3 max-h-64 rounded-lg border border-border" />
          )}
        </ToolPanel>
      )}

      <PrivacyNotice />
    </div>
  );
}
