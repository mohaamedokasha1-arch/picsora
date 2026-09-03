'use client';

import * as React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  jsonStats,
  parseJson,
  sortJsonKeys,
  type JsonValue,
} from '@/lib/developer-tools';
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
import { CodeBlock } from './highlight';

type Indent = '2' | '4' | 'tab';

function JsonNode({ name, value, depth }: { name: string | null; value: JsonValue; depth: number }) {
  const [open, setOpen] = React.useState(depth < 2);
  const isObject = value !== null && typeof value === 'object';

  if (!isObject) {
    const display =
      typeof value === 'string' ? `"${value}"` : value === null ? 'null' : String(value);
    const color =
      typeof value === 'string'
        ? 'text-emerald-700 dark:text-emerald-400'
        : typeof value === 'number'
          ? 'text-amber-700 dark:text-amber-400'
          : typeof value === 'boolean'
            ? 'text-blue-700 dark:text-blue-400'
            : 'text-muted-foreground';
    return (
      <div className="flex gap-2 py-0.5 font-mono text-[13px]" style={{ paddingInlineStart: depth * 14 }}>
        {name !== null && <span className="text-foreground">{name}:</span>}
        <span className={color}>{display}</span>
      </div>
    );
  }

  const entries: [string, JsonValue][] = Array.isArray(value)
    ? value.map((v, i) => [String(i), v])
    : Object.entries(value);

  return (
    <div style={{ paddingInlineStart: depth ? 14 : 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1 py-0.5 font-mono text-[13px] text-foreground hover:text-primary"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform rtl:rotate-180', open && 'rotate-90 rtl:rotate-90')} />
        {name !== null && <span>{name}:</span>}
        <span className="text-muted-foreground">
          {Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
      </button>
      {open && entries.map(([key, child]) => <JsonNode key={key} name={key} value={child} depth={depth + 1} />)}
    </div>
  );
}

export default function JsonFormatterTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [indent, setIndent] = React.useState<Indent>('2');
  const [tab, setTab] = React.useState<'output' | 'tree' | 'stats'>('output');
  const [error, setError] = React.useState<string | null>(null);
  const [valid, setValid] = React.useState<string | null>(null);
  const [parsed, setParsed] = React.useState<JsonValue | null>(null);

  const indentValue = indent === 'tab' ? ('\t' as const) : Number(indent);

  const withParsed = (transform: (value: JsonValue) => string) => {
    setValid(null);
    const result = parseJson(input);
    if (!result.ok || result.value === undefined) {
      setError(
        t('errors.jsonParse', {
          line: result.error?.line ?? 0,
          column: result.error?.column ?? 0,
          message: result.error?.message ?? '',
        }),
      );
      setOutput('');
      setParsed(null);
      return;
    }
    setError(null);
    setParsed(result.value);
    setOutput(transform(result.value));
  };

  const format = () => withParsed((value) => JSON.stringify(value, null, indentValue));
  const minify = () => withParsed((value) => JSON.stringify(value));
  const sortKeys = () => withParsed((value) => JSON.stringify(sortJsonKeys(value), null, indentValue));
  const validate = () => {
    const result = parseJson(input);
    if (result.ok) {
      setError(null);
      setParsed(result.value ?? null);
      setValid(t('dev.jsonValid'));
    } else {
      setValid(null);
      setParsed(null);
      setError(
        t('errors.jsonParse', {
          line: result.error?.line ?? 0,
          column: result.error?.column ?? 0,
          message: result.error?.message ?? '',
        }),
      );
    }
  };

  const stats = parsed !== null ? jsonStats(parsed) : null;

  const reset = () => {
    setInput('');
    setOutput('');
    setError(null);
    setValid(null);
    setParsed(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      format();
    }
    if (e.key === 'Escape') reset();
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('textTools.input')}
        actions={
          <>
            <ToggleGroup
              value={indent}
              onChange={setIndent}
              options={[
                { value: '2', label: '2' },
                { value: '4', label: '4' },
                { value: 'tab', label: 'Tab' },
              ]}
            />
            <ResetButton onClick={reset} />
          </>
        }
      >
        <CodeArea
          value={input}
          onChange={setInput}
          onKeyDown={onKeyDown}
          placeholder='{"name":"Piclizer","tools":33}'
          ariaLabel={t('textTools.input')}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={format} disabled={!input}>
            {t('dev.format')}
          </Button>
          <Button variant="outline" onClick={minify} disabled={!input}>
            {t('dev.minify')}
          </Button>
          <Button variant="outline" onClick={validate} disabled={!input}>
            {t('dev.validate')}
          </Button>
          <Button variant="outline" onClick={sortKeys} disabled={!input}>
            {t('dev.sortKeys')}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{t('dev.shortcutHint')}</p>
      </ToolPanel>

      {error && <InlineError message={error} />}
      {valid && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
          {valid}
        </div>
      )}

      {(output || parsed !== null) && (
        <ToolPanel
          title={t('textTools.output')}
          actions={
            <>
              <ToggleGroup
                value={tab}
                onChange={setTab}
                options={[
                  { value: 'output', label: t('dev.formatted') },
                  { value: 'tree', label: t('dev.treeView') },
                  { value: 'stats', label: t('dev.stats') },
                ]}
              />
              {output && (
                <>
                  <CopyButton value={output} />
                  <TextDownloadButton value={output} filename="data.json" mime="application/json" />
                </>
              )}
            </>
          }
        >
          {tab === 'output' && <CodeBlock code={output} language="json" ariaLabel={t('textTools.output')} />}
          {tab === 'tree' && parsed !== null && (
            <div className="max-h-[420px] overflow-auto rounded-lg border border-border bg-secondary/20 p-3">
              <JsonNode name={null} value={parsed} depth={0} />
            </div>
          )}
          {tab === 'stats' && stats && (
            <StatGrid
              items={[
                { label: t('dev.depth'), value: String(stats.depth) },
                { label: t('dev.totalKeys'), value: String(stats.keys) },
                { label: t('dev.totalValues'), value: String(stats.values) },
                ...Object.entries(stats.types).map(([type, count]) => ({
                  label: type,
                  value: String(count),
                })),
              ]}
            />
          )}
        </ToolPanel>
      )}

      <PrivacyNotice />
    </div>
  );
}
