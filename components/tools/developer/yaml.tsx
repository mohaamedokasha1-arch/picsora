'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
import { sizeStats, type CodeSizeStats } from '@/lib/developer-tools/formatters';
import {
  CheckboxRow,
  CodeArea,
  CopyButton,
  InlineError,
  Notice,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextDownloadButton,
  ToggleGroup,
  ToolPanel,
} from '../kit';

const MAX_YAML_LENGTH = 1_000_000;

interface YamlModule {
  parse: (text: string) => unknown;
  stringify: (value: unknown, options?: Record<string, unknown>) => string;
}

let yamlPromise: Promise<YamlModule> | null = null;
function loadYaml(): Promise<YamlModule> {
  if (!yamlPromise) yamlPromise = import('yaml') as Promise<YamlModule>;
  return yamlPromise;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Validate, format and convert YAML — local, lazily loaded parser. */
export default function YamlFormatterTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [indent, setIndent] = React.useState<'2' | '4'>('2');
  const [sortKeys, setSortKeys] = React.useState(false);
  const [valid, setValid] = React.useState<string | null>(null);
  const [stats, setStats] = React.useState<CodeSizeStats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const parse = async (): Promise<unknown> => {
    if (input.length > MAX_YAML_LENGTH) throw new Error(t('errors.yamlTooLarge'));
    const yaml = await loadYaml();
    try {
      return yaml.parse(input);
    } catch (e) {
      const message = e instanceof Error ? e.message.split('\n')[0] : 'Invalid YAML';
      throw new Error(t('errors.yamlParse', { message }));
    }
  };

  const format = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setValid(null);
    try {
      const yaml = await loadYaml();
      const value = await parse();
      const normalised = sortKeys ? sortKeysDeep(value) : value;
      const text = yaml.stringify(normalised, { indent: indent === '4' ? 4 : 2 });
      setOutput(text);
      setStats(sizeStats(input, text));
      setValid(t('yaml.validYaml'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
      setOutput('');
      setStats(null);
    } finally {
      setBusy(false);
    }
  };

  const toJson = async () => {
    if (!input.trim()) return;
    setBusy(true);
    setError(null);
    setValid(null);
    try {
      const value = await parse();
      const text = `${JSON.stringify(sortKeys ? sortKeysDeep(value) : value, null, 2)}\n`;
      setOutput(text);
      setStats(sizeStats(input, text));
      setValid(t('yaml.validYaml'));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
      setOutput('');
      setStats(null);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setInput('');
    setOutput('');
    setValid(null);
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
          }}
          placeholder={'server:\n  host: localhost\n  port: 8080\nfeatures:\n  - auth\n  - billing'}
          ariaLabel={t('textTools.input')}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ToggleGroup<'2' | '4'>
            label={t('sql.indent')}
            value={indent}
            onChange={setIndent}
            options={[
              { value: '2', label: t('sql.indent2') },
              { value: '4', label: t('sql.indent4') },
            ]}
          />
          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t('dev.options') ?? ''}</span>
            <CheckboxRow checked={sortKeys} onChange={setSortKeys} label={t('yaml.sortKeys')} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void format()} loading={busy}>
            {t('dev.format')}
          </Button>
          <Button variant="outline" onClick={() => void toJson()} disabled={busy}>
            {t('yaml.toJson')}
          </Button>
        </div>
      </ToolPanel>

      <InlineError message={error} />
      {valid && !error && <Notice variant="privacy">{valid}</Notice>}

      {output && (
        <ToolPanel
          title={t('textTools.output')}
          actions={
            <>
              <CopyButton value={output} />
              <TextDownloadButton value={output} filename="data.yaml" mime="text/yaml;charset=utf-8" />
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
            { label: t('dev.lines'), value: String(stats.outputLines) },
          ]}
        />
      )}

      <PrivacyNotice />
    </div>
  );
}
