'use client';

import * as React from 'react';
import { ArrowDownUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { decodeUrl, encodeUrl, type UrlMode } from '@/lib/developer-tools';
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

export default function UrlCodecTool() {
  const t = useTranslations();
  const [operation, setOperation] = React.useState<'encode' | 'decode'>('encode');
  const [mode, setMode] = React.useState<UrlMode>('component');
  const [input, setInput] = React.useState('');
  const [batch, setBatch] = React.useState(false);

  const { output, error } = React.useMemo(() => {
    if (!input) return { output: '', error: null as string | null };
    const run = (value: string) => (operation === 'encode' ? encodeUrl(value, mode) : decodeUrl(value, mode));
    try {
      if (batch) return { output: input.split('\n').map((line) => (line ? run(line) : '')).join('\n'), error: null };
      return { output: run(input), error: null };
    } catch {
      return { output: '', error: t('errors.malformedUrl') };
    }
  }, [input, operation, mode, batch, t]);

  return (
    <div className="space-y-5">
      <ToolPanel title={t('toolShell.settingsTitle')} actions={<ResetButton onClick={() => setInput('')} />}>
        <div className="grid gap-4 md:grid-cols-2">
          <ToggleGroup
            label={t('dev.operation')}
            value={operation}
            onChange={setOperation}
            options={[
              { value: 'encode', label: t('dev.encode') },
              { value: 'decode', label: t('dev.decode') },
            ]}
          />
          <ToggleGroup
            label={t('dev.encodingType')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'component', label: t('dev.urlComponent') },
              { value: 'full', label: t('dev.urlFull') },
              { value: 'base64url', label: t('dev.base64Url') },
            ]}
          />
        </div>
        <div className="mt-3">
          <CheckboxRow checked={batch} onChange={setBatch} label={t('dev.batchMode')} hint={t('dev.batchHint')} />
        </div>
      </ToolPanel>

      {error && <InlineError message={error} />}

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title={t('textTools.input')}>
          <TextArea
            mono
            dir="ltr"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="https://example.com/path?q=hello world"
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
            className="min-h-[220px] resize-y bg-secondary/30"
          />
        </ToolPanel>
      </div>

      <div className="flex justify-center">
        <Button
          variant="outline"
          size="sm"
          disabled={!output}
          onClick={() => {
            setInput(output);
            setOperation((op) => (op === 'encode' ? 'decode' : 'encode'));
          }}
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          {t('dev.swapDirection')}
        </Button>
      </div>

      <PrivacyNotice />
    </div>
  );
}
