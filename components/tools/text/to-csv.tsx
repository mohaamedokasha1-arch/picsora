'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Select } from '@/components/ui/select';
import { linesToCsv, type CsvInputDelimiter } from '@/lib/text-processing/lines-convert';
import {
  CheckboxRow,
  CopyButton,
  Field,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextArea,
  TextDownloadButton,
  ToolPanel,
} from '../kit';

/** Convert delimiter-separated lines (tabs, semicolons, pipes…) into CSV. */
export default function TextToCsvTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [delimiter, setDelimiter] = React.useState<CsvInputDelimiter>('tab');
  const [skipEmpty, setSkipEmpty] = React.useState(true);
  const [hasHeader, setHasHeader] = React.useState(false);

  const result = React.useMemo(
    () => linesToCsv(text, { delimiter, skipEmpty, hasHeader }),
    [text, delimiter, skipEmpty, hasHeader],
  );

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <ToolPanel title={t('textTools.options')}>
        <div className="grid gap-4 md:grid-cols-3 md:items-end">
          <Field label={t('textTools.inputDelimiter')}>
            <Select
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value as CsvInputDelimiter)}
              options={[
                { value: 'tab', label: t('textTools.delimTab') },
                { value: 'semicolon', label: t('textTools.delimSemicolon') },
                { value: 'pipe', label: t('textTools.delimPipe') },
                { value: 'comma', label: t('textTools.delimComma') },
                { value: 'space', label: t('textTools.delimSpace') },
              ]}
            />
          </Field>
          <CheckboxRow checked={skipEmpty} onChange={setSkipEmpty} label={t('textTools.skipEmpty')} />
          <CheckboxRow checked={hasHeader} onChange={setHasHeader} label={t('textTools.hasHeader')} />
        </div>
      </ToolPanel>

      {text.trim() && (
        <StatGrid
          columns={3}
          items={[
            { label: t('textTools.rowsCount'), value: String(result.rows), accent: true },
            { label: t('textTools.colsCount'), value: String(result.cols) },
            ...(hasHeader ? [{ label: t('textTools.headerRow'), value: '✓' }] : []),
          ]}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title={t('textTools.input')}
          actions={<ResetButton onClick={() => setText('')} label={t('textTools.clear')} />}
        >
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('textTools.delimPlaceholder')}
            aria-label={t('textTools.input')}
            className="min-h-[260px] resize-y"
          />
        </ToolPanel>

        <ToolPanel
          title={t('textTools.output')}
          actions={
            <>
              <CopyButton value={result.csv} />
              <TextDownloadButton value={result.csv} filename="data.csv" mime="text/csv;charset=utf-8" />
            </>
          }
        >
          <TextArea
            value={result.csv}
            readOnly
            aria-label={t('textTools.output')}
            mono
            dir="ltr"
            className="min-h-[260px] resize-y"
          />
        </ToolPanel>
      </div>
    </div>
  );
}
