'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
import { minifyCss, formatCssFallback } from '@/lib/developer-tools/cssMinifier';
import { CodeToolError, formatCss, sizeStats, type CodeSizeStats } from '@/lib/developer-tools/formatters';
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

export default function CssFormatterTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [stats, setStats] = React.useState<CodeSizeStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const format = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await formatCss(input);
      setOutput(result);
      setStats(sizeStats(input, result));
    } catch (e) {
      // Prettier failed to parse — fall back to the built-in beautifier so the
      // user still gets usable output, and surface the parse message.
      const detail = e instanceof CodeToolError ? e.detail.split('\n')[0] : '';
      const fallback = formatCssFallback(input);
      setOutput(fallback);
      setStats(sizeStats(input, fallback));
      setError(t('errors.cssSyntax', { message: detail }));
    } finally {
      setBusy(false);
    }
  };

  const minify = () => {
    if (!input.trim()) return;
    setError(null);
    const result = minifyCss(input);
    setOutput(result.css);
    setStats(sizeStats(input, result.css));
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
              void format();
            }
            if (e.key === 'Escape') reset();
          }}
          placeholder={'.card{color:#ffffff;margin:0px;padding:8px 16px}'}
          ariaLabel={t('textTools.input')}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={format} disabled={!input || busy} loading={busy}>
            {t('dev.format')}
          </Button>
          <Button variant="outline" onClick={minify} disabled={!input}>
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
              <TextDownloadButton value={output} filename="styles.css" mime="text/css" />
            </>
          }
        >
          <CodeBlock code={output} language="css" ariaLabel={t('textTools.output')} />
        </ToolPanel>
      )}

      <PrivacyNotice />
    </div>
  );
}
