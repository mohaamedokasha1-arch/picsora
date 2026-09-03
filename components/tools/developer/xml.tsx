'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatXml, minifyXml, validateXml, xmlToJson } from '@/lib/developer-tools';
import {
  CodeArea,
  CopyButton,
  InlineError,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextDownloadButton,
  ToolPanel,
} from '../kit';
import { CodeBlock } from './highlight';

export default function XmlFormatterTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [asJson, setAsJson] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [valid, setValid] = React.useState<string | null>(null);

  const stats = React.useMemo(() => (input.trim() ? validateXml(input) : null), [input]);

  const handle = (result: { ok: boolean; text?: string; error?: string }, json = false) => {
    setValid(null);
    if (!result.ok) {
      setError(t('errors.xmlParse', { message: result.error ?? '' }));
      setOutput('');
      return;
    }
    setError(null);
    setAsJson(json);
    setOutput(result.text ?? '');
  };

  const reset = () => {
    setInput('');
    setOutput('');
    setError(null);
    setValid(null);
  };

  return (
    <div className="space-y-5">
      <ToolPanel title={t('textTools.input')} actions={<ResetButton onClick={reset} />}>
        <CodeArea
          value={input}
          onChange={setInput}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handle(formatXml(input));
            }
            if (e.key === 'Escape') reset();
          }}
          placeholder={'<root><item id="1">Hello</item></root>'}
          ariaLabel={t('textTools.input')}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => handle(formatXml(input))} disabled={!input}>
            {t('dev.format')}
          </Button>
          <Button variant="outline" onClick={() => handle(minifyXml(input))} disabled={!input}>
            {t('dev.minify')}
          </Button>
          <Button
            variant="outline"
            disabled={!input}
            onClick={() => {
              const result = validateXml(input);
              if (result.ok) {
                setError(null);
                setValid(t('dev.xmlValid'));
              } else {
                setValid(null);
                setError(t('errors.xmlParse', { message: result.error ?? '' }));
              }
            }}
          >
            {t('dev.validate')}
          </Button>
          <Button
            variant="outline"
            disabled={!input}
            onClick={() => {
              const result = xmlToJson(input);
              handle(
                {
                  ok: result.ok,
                  text: result.ok ? JSON.stringify(result.value, null, 2) : undefined,
                  error: result.error,
                },
                true,
              );
            }}
          >
            {t('dev.toJson')}
          </Button>
        </div>
      </ToolPanel>

      {error && <InlineError message={error} />}
      {valid && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {valid}
        </div>
      )}

      {stats?.ok && (
        <StatGrid
          columns={3}
          items={[
            { label: t('dev.elements'), value: String(stats.elements) },
            { label: t('dev.attributes'), value: String(stats.attributes) },
            { label: t('dev.depth'), value: String(stats.depth) },
          ]}
        />
      )}

      {output && (
        <ToolPanel
          title={t('textTools.output')}
          actions={
            <>
              <CopyButton value={output} />
              <TextDownloadButton
                value={output}
                filename={asJson ? 'data.json' : 'data.xml'}
                mime={asJson ? 'application/json' : 'application/xml'}
              />
            </>
          }
        >
          <CodeBlock code={output} language={asJson ? 'json' : 'markup'} ariaLabel={t('textTools.output')} />
        </ToolPanel>
      )}

      <PrivacyNotice />
    </div>
  );
}
