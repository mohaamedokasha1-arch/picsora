'use client';

import * as React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  csvToJson,
  DELIMITERS,
  jsonToCsv,
  type Delimiter,
} from '@/lib/developer-tools/csv';
import {
  CheckboxRow,
  CodeArea,
  CopyButton,
  InlineError,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextDownloadButton,
  ToolPanel,
  ToggleGroup,
} from '../kit';

type Direction = 'json2csv' | 'csv2json';

const DELIMITER_LABEL: Record<Delimiter, string> = {
  ',': 'dev.delimComma',
  ';': 'dev.delimSemicolon',
  '\t': 'dev.delimTab',
  '|': 'dev.delimPipe',
};

export default function JsonCsvConverterTool() {
  const t = useTranslations();
  const [direction, setDirection] = React.useState<Direction>('json2csv');
  const [input, setInput] = React.useState('');
  const [output, setOutput] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [delimiter, setDelimiter] = React.useState<Delimiter>(',');
  const [flatten, setFlatten] = React.useState(true);
  const [header, setHeader] = React.useState(true);
  const [types, setTypes] = React.useState(true);
  const [rows, setRows] = React.useState(0);
  const [columnCount, setColumnCount] = React.useState(0);

  const convert = () => {
    setError(null);
    if (direction === 'json2csv') {
      const result = jsonToCsv(input, { delimiter, flatten, header });
      if (!result.ok) {
        setError(result.error === 'emptyData' ? t('dev.emptyData') : t('dev.invalidJson'));
        setOutput('');
        setRows(0);
        setColumnCount(0);
        return;
      }
      setOutput(result.value.csv);
      setRows(result.value.rows);
      setColumnCount(result.value.columns.length);
      return;
    }
    const result = csvToJson(input, { delimiter, types });
    if (!result.ok) {
      setError(t('dev.emptyData'));
      setOutput('');
      setRows(0);
      setColumnCount(0);
      return;
    }
    setOutput(result.value.json);
    setRows(result.value.rows);
    setColumnCount(result.value.columns.length);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setError(null);
    setRows(0);
    setColumnCount(0);
  };

  const swap = () => {
    setDirection((d) => (d === 'json2csv' ? 'csv2json' : 'json2csv'));
    setInput(output);
    setOutput('');
    setError(null);
  };

  const placeholder =
    direction === 'json2csv'
      ? '[{ "name": "Ada", "role": "engineer" }]'
      : 'name,role\nAda,engineer';

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('dev.direction')}
        actions={<ResetButton onClick={clearAll} label={t('textTools.clear')} />}
      >
        <div className="flex flex-wrap items-end gap-4">
          <ToggleGroup
            value={direction}
            onChange={(value) => {
              setDirection(value);
              setOutput('');
              setError(null);
            }}
            options={[
              { value: 'json2csv' as Direction, label: 'JSON → CSV' },
              { value: 'csv2json' as Direction, label: 'CSV → JSON' },
            ]}
          />
          <Button variant="outline" size="sm" onClick={swap} disabled={!output}>
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {t('dev.swapDirection')}
          </Button>
        </div>
      </ToolPanel>

      <ToolPanel title={t('textTools.input')}>
        <CodeArea
          value={input}
          onChange={setInput}
          placeholder={placeholder}
          ariaLabel={t('textTools.input')}
          minHeight={220}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') convert();
          }}
        />
      </ToolPanel>

      <ToolPanel title={t('dev.options')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t('dev.delimiter')}</span>
            <Select
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value as Delimiter)}
              options={DELIMITERS.map((value) => ({ value, label: t(DELIMITER_LABEL[value] as never) }))}
            />
          </label>
          {direction === 'json2csv' ? (
            <>
              <div className="grid gap-2 self-end">
                <CheckboxRow checked={header} onChange={setHeader} label={t('dev.headerRow')} />
                <CheckboxRow checked={flatten} onChange={setFlatten} label={t('dev.flattenNested')} />
              </div>
            </>
          ) : (
            <div className="grid gap-2 self-end">
              <CheckboxRow checked={types} onChange={setTypes} label={t('dev.detectTypes')} />
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={convert} disabled={!input.trim()}>
            {t('dev.convert')}
          </Button>
          <span className="text-xs text-muted-foreground">{t('dev.shortcutHint')}</span>
        </div>
      </ToolPanel>

      <InlineError message={error} />

      {output && (
        <StatGrid
          columns={3}
          items={[
            { label: t('dev.rows'), value: rows.toLocaleString(), accent: true },
            { label: t('dev.columns'), value: columnCount.toLocaleString() },
            { label: t('dev.outputSize'), value: `${new Blob([output]).size.toLocaleString()} B` },
          ]}
        />
      )}

      <ToolPanel
        title={t('textTools.output')}
        actions={
          <>
            <CopyButton value={output} />
            <TextDownloadButton
              value={output}
              filename={direction === 'json2csv' ? 'data.csv' : 'data.json'}
              mime={direction === 'json2csv' ? 'text/csv;charset=utf-8' : 'application/json'}
            />
          </>
        }
      >
        {output ? (
          <CodeArea value={output} readOnly ariaLabel={t('textTools.output')} minHeight={220} />
        ) : (
          <p className="text-sm text-muted-foreground">{t('dev.outputEmptyState')}</p>
        )}
      </ToolPanel>

      <PrivacyNotice text={t('common.allProcessingText')} />
    </div>
  );
}
