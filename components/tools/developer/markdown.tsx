'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { CodeToolError, sizeStats, type CodeSizeStats } from '@/lib/developer-tools/formatters';
import { formatBytes } from '@/lib/utils';
import {
  CodeArea,
  CopyButton,
  InlineError,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextDownloadButton,
  ToggleGroup,
  ToolPanel,
} from '../kit';

type ProseWrap = 'always' | 'never' | 'preserve';

async function formatMarkdown(
  input: string,
  printWidth: number,
  proseWrap: ProseWrap,
): Promise<string> {
  try {
    const [{ format }, markdown] = await Promise.all([
      import('prettier/standalone'),
      import('prettier/plugins/markdown'),
    ]);
    return await format(input, {
      parser: 'markdown',
      plugins: [markdown.default ?? markdown],
      printWidth,
      proseWrap,
    });
  } catch (error) {
    throw new CodeToolError('markdownSyntax', error instanceof Error ? error.message : '');
  }
}

function markdownStats(text: string): { words: number; headings: number; links: number; codeBlocks: number } {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const headings = (text.match(/^#{1,6}\s/mg) ?? []).length;
  const links = (text.match(/\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  const codeBlocks = Math.floor((text.match(/```/g) ?? []).length / 2);
  return { words, headings, links, codeBlocks };
}

/** Format Markdown documents with Prettier — loaded lazily, runs locally. */
export default function MarkdownFormatterTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [width, setWidth] = React.useState<'80' | '100' | '120'>('80');
  const [wrap, setWrap] = React.useState<ProseWrap>('preserve');
  const [stats, setStats] = React.useState<CodeSizeStats | null>(null);
  const [docStats, setDocStats] = React.useState<ReturnType<typeof markdownStats> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const format = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const result = await formatMarkdown(input, Number(width), wrap);
      setOutput(result);
      setStats(sizeStats(input, result));
      setDocStats(markdownStats(result));
    } catch (e) {
      const detail = e instanceof CodeToolError ? e.detail.split('\n')[0] : '';
      setError(detail ? t('errors.markdownSyntax', { message: detail }) : t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setInput('');
    setOutput('');
    setStats(null);
    setDocStats(null);
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
          }}
          placeholder={'# My document\n\nSome **bold** text and a [link](https://example.com).'}
          ariaLabel={t('textTools.input')}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ToggleGroup<'80' | '100' | '120'>
            label={t('markdown.lineWidth')}
            value={width}
            onChange={setWidth}
            options={[
              { value: '80', label: '80' },
              { value: '100', label: '100' },
              { value: '120', label: '120' },
            ]}
          />
          <ToggleGroup<ProseWrap>
            label={t('markdown.proseWrap')}
            value={wrap}
            onChange={setWrap}
            options={[
              { value: 'preserve', label: t('markdown.wrapPreserve') },
              { value: 'always', label: t('markdown.wrapAlways') },
              { value: 'never', label: t('markdown.wrapNever') },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void format()} loading={busy}>
            {t('dev.format')}
          </Button>
        </div>
      </ToolPanel>

      <InlineError message={error} />

      {output && (
        <ToolPanel
          title={t('textTools.output')}
          actions={
            <>
              <CopyButton value={output} />
              <TextDownloadButton value={output} filename="document.md" mime="text/markdown;charset=utf-8" />
            </>
          }
        >
          <CodeArea value={output} readOnly ariaLabel={t('textTools.output')} minHeight={220} />
        </ToolPanel>
      )}

      {stats && docStats && (
        <StatGrid
          columns={4}
          items={[
            { label: t('dev.outputSize'), value: formatBytes(stats.outputBytes), accent: true },
            { label: t('markdown.words'), value: String(docStats.words) },
            { label: t('markdown.headings'), value: String(docStats.headings) },
            { label: t('markdown.links'), value: String(docStats.links) },
          ]}
        />
      )}

      <PrivacyNotice />
    </div>
  );
}
