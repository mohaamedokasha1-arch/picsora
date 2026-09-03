'use client';

import * as React from 'react';
import { ArrowDownUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { decodeHtml, encodeHtml, type HtmlEncodeDepth } from '@/lib/developer-tools';
import { CopyButton, Notice, PrivacyNotice, ResetButton, TextArea, ToggleGroup, ToolPanel } from '../kit';

export default function HtmlCodecTool() {
  const t = useTranslations();
  const [operation, setOperation] = React.useState<'encode' | 'decode'>('encode');
  const [depth, setDepth] = React.useState<HtmlEncodeDepth>('basic');
  const [input, setInput] = React.useState('');

  const output = React.useMemo(
    () => (!input ? '' : operation === 'encode' ? encodeHtml(input, depth) : decodeHtml(input)),
    [input, operation, depth],
  );

  // The preview is rendered inside a fully sandboxed iframe (no scripts, no
  // same-origin access) so untrusted markup can never touch the page.
  const previewHtml = operation === 'encode' ? input : output;

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
          {operation === 'encode' && (
            <ToggleGroup
              label={t('dev.encodingDepth')}
              value={depth}
              onChange={setDepth}
              options={[
                { value: 'basic', label: t('dev.depthBasic') },
                { value: 'nonAscii', label: t('dev.depthNonAscii') },
                { value: 'all', label: t('dev.depthAll') },
              ]}
            />
          )}
        </div>
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel title={t('textTools.input')}>
          <TextArea
            mono
            dir="ltr"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='<p class="hi">Hello & welcome</p>'
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

      <ToolPanel title={t('dev.renderedPreview')}>
        <iframe
          title={t('dev.renderedPreview')}
          sandbox=""
          srcDoc={previewHtml}
          className="h-56 w-full rounded-lg border border-border bg-white"
        />
        <p className="mt-2 text-xs text-muted-foreground">{t('dev.previewSandboxNote')}</p>
      </ToolPanel>

      <Notice>{t('dev.htmlHint')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
