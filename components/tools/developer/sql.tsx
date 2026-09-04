'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
import { sizeStats, type CodeSizeStats } from '@/lib/developer-tools/formatters';
import {
  formatSql,
  MAX_SQL_LENGTH,
  minifySql,
  type SqlKeywordCase,
} from '@/lib/developer-tools/sql';
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

/** Format / minify SQL — dependency-free and fully local. */
export default function SqlFormatterTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [keywordCase, setKeywordCase] = React.useState<SqlKeywordCase>('upper');
  const [indent, setIndent] = React.useState<'2' | '4'>('2');
  const [stats, setStats] = React.useState<CodeSizeStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const format = () => {
    if (!input.trim()) return;
    setError(null);
    try {
      const result = formatSql(input, {
        keywordCase,
        indentSize: indent === '4' ? 4 : 2,
      });
      setOutput(result);
      setStats(sizeStats(input, result));
    } catch {
      setError(t('errors.sqlTooLarge', { max: formatBytes(MAX_SQL_LENGTH) }));
    }
  };

  const minify = () => {
    if (!input.trim()) return;
    setError(null);
    try {
      const result = minifySql(input);
      setOutput(result);
      setStats(sizeStats(input, result));
    } catch {
      setError(t('errors.sqlTooLarge', { max: formatBytes(MAX_SQL_LENGTH) }));
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
              format();
            }
          }}
          placeholder="select id, name from users where active = 1 order by name;"
          ariaLabel={t('textTools.input')}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ToggleGroup<SqlKeywordCase>
            label={t('sql.keywordCase')}
            value={keywordCase}
            onChange={setKeywordCase}
            options={[
              { value: 'upper', label: 'UPPERCASE' },
              { value: 'lower', label: 'lowercase' },
              { value: 'preserve', label: t('sql.preserve') },
            ]}
          />
          <ToggleGroup<'2' | '4'>
            label={t('sql.indent')}
            value={indent}
            onChange={setIndent}
            options={[
              { value: '2', label: t('sql.indent2') },
              { value: '4', label: t('sql.indent4') },
            ]}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={format}>{t('dev.format')}</Button>
          <Button variant="outline" onClick={minify}>
            {t('dev.minify')}
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
              <TextDownloadButton value={output} filename="query.sql" mime="text/plain;charset=utf-8" />
            </>
          }
        >
          <CodeArea value={output} readOnly ariaLabel={t('textTools.output')} minHeight={220} />
        </ToolPanel>
      )}

      {stats && (
        <StatGrid
          columns={3}
          items={[
            { label: t('dev.originalSize'), value: formatBytes(stats.originalBytes) },
            { label: t('dev.outputSize'), value: formatBytes(stats.outputBytes), accent: true },
            {
              label: t('dev.lines'),
              value: String(stats.outputLines),
              hint: t('sql.linesHint', { before: stats.originalLines }),
            },
          ]}
        />
      )}

      <PrivacyNotice />
    </div>
  );
}
