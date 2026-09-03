'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
import { CodeToolError, formatJavaScript, minifyJavaScript, sizeStats, type CodeSizeStats } from '@/lib/developer-tools/formatters';
import {
  CodeArea,
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextDownloadButton,
  ToolPanel,
} from '../kit';
import { CodeBlock } from './highlight';

export default function JavaScriptFormatterTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [stats, setStats] = React.useState<CodeSizeStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const run = async (action: 'format' | 'minify') => {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = action === 'format' ? await formatJavaScript(input) : await minifyJavaScript(input);
      setOutput(result);
      setStats(sizeStats(input, result));
    } catch (e) {
      const detail = e instanceof CodeToolError ? e.detail : '';
      setError(t('errors.jsSyntax', { message: detail.split('\n')[0] || '' }));
      setOutput('');
      setStats(null);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setInput('');
    setOutput('');
    setStats(null);
    setError(null);
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
              void run('format');
            }
            if (e.key === 'Escape') reset();
          }}
          placeholder={'const greet=(name)=>{return `Hello ${name}`}'}
          ariaLabel={t('textTools.input')}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => run('format')} disabled={!input || busy} loading={busy}>
            {t('dev.format')}
          </Button>
          <Button variant="outline" onClick={() => run('minify')} disabled={!input || busy}>
            {t('dev.minify')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('dev.shortcutHint')}</p>
      </ToolPanel>

      {error && <InlineError message={error} />}

      {stats && (
        <StatGrid
          items={[
            { label: t('dev.originalSize'), value: formatBytes(stats.originalBytes) },
            { label: t('dev.outputSize'), value: formatBytes(stats.outputBytes) },
            {
              label: t('dev.reduction'),
              value: `${stats.savedPercent >= 0 ? '−' : '+'}${Math.abs(stats.savedPercent).toFixed(1)}%`,
              accent: stats.savedPercent > 0,
            },
            { label: t('dev.lines'), value: `${stats.originalLines} → ${stats.outputLines}` },
          ]}
        />
      )}

      {output && (
        <ToolPanel
          title={t('textTools.output')}
          actions={
            <>
              <CopyButton value={output} />
              <TextDownloadButton value={output} filename="script.js" mime="text/javascript" />
            </>
          }
        >
          <CodeBlock code={output} language="javascript" ariaLabel={t('textTools.output')} />
        </ToolPanel>
      )}

      <Notice>{t('dev.jsLocalNote')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
