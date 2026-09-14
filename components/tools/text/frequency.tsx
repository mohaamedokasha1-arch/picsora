'use client';

import * as React from 'react';
import { ClipboardPaste, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  countFrequency,
  defaultFrequencyOptions,
  frequencyToCsv,
  frequencyToJson,
  type FrequencyMode,
  type FrequencySort,
} from '@/lib/text-processing/frequency';
import {
  CheckboxRow,
  CopyButton,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextArea,
  TextDownloadButton,
  ToggleGroup,
  ToolPanel,
  useDebounced,
  useTextFileInput,
} from '../kit';

const LIMITS = [10, 25, 50, 0] as const;

export default function FrequencyCounterTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [mode, setMode] = React.useState<FrequencyMode>(defaultFrequencyOptions.mode);
  const [sort, setSort] = React.useState<FrequencySort>(defaultFrequencyOptions.sort);
  const [limit, setLimit] = React.useState<number>(defaultFrequencyOptions.limit);
  const [ignoreCase, setIgnoreCase] = React.useState(defaultFrequencyOptions.ignoreCase);
  const [ignoreStopWords, setIgnoreStopWords] = React.useState(defaultFrequencyOptions.ignoreStopWords);
  const [includeNumbers, setIncludeNumbers] = React.useState(defaultFrequencyOptions.includeNumbers);
  const [minLength, setMinLength] = React.useState(defaultFrequencyOptions.minLength);
  const debounced = useDebounced(text, 250);
  const { input, open } = useTextFileInput(setText);

  const result = React.useMemo(
    () => countFrequency(debounced, { mode, ignoreCase, ignoreStopWords, includeNumbers, minLength, limit, sort }),
    [debounced, mode, ignoreCase, ignoreStopWords, includeNumbers, minLength, limit, sort],
  );

  const headers: [string, string, string] = [
    t('textTools.freqTerm'),
    t('textTools.freqCount'),
    t('textTools.freqPercent'),
  ];
  const csv = result.entries.length ? frequencyToCsv(result, headers) : '';
  const json = result.entries.length ? frequencyToJson(result) : '';
  const isWords = mode === 'words';

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      /* clipboard may be blocked — manual paste still works */
    }
  };

  const reset = () => {
    setText('');
    setMode(defaultFrequencyOptions.mode);
    setSort(defaultFrequencyOptions.sort);
    setLimit(defaultFrequencyOptions.limit);
    setIgnoreCase(defaultFrequencyOptions.ignoreCase);
    setIgnoreStopWords(defaultFrequencyOptions.ignoreStopWords);
    setIncludeNumbers(defaultFrequencyOptions.includeNumbers);
    setMinLength(defaultFrequencyOptions.minLength);
  };

  return (
    <div className="space-y-5">
      {input}

      <ToolPanel
        title={t('textTools.yourText')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={paste}>
              <ClipboardPaste className="h-3.5 w-3.5" />
              {t('textTools.paste')}
            </Button>
            <Button variant="outline" size="sm" onClick={open}>
              <Upload className="h-3.5 w-3.5" />
              {t('textTools.uploadTxt')}
            </Button>
            <ResetButton onClick={reset} label={t('textTools.clear')} />
          </>
        }
      >
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('textTools.typeOrPaste')}
          aria-label={t('textTools.yourText')}
          className="min-h-[220px] resize-y"
        />
      </ToolPanel>

      <ToolPanel title={t('textTools.freqOptionsTitle')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ToggleGroup
            label={t('textTools.freqMode')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'words', label: t('textTools.freqModeWords'), hint: t('textTools.freqModeWordsHint') },
              {
                value: 'characters',
                label: t('textTools.freqModeCharacters'),
                hint: t('textTools.freqModeCharactersHint'),
              },
            ]}
          />
          <ToggleGroup
            label={t('textTools.freqSortLabel')}
            value={sort}
            onChange={setSort}
            options={[
              { value: 'count', label: t('textTools.freqSortCount') },
              { value: 'alpha', label: t('textTools.freqSortAlpha') },
            ]}
          />
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t('textTools.freqListSize')}</span>
            <Select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              options={LIMITS.map((value) => ({
                value: String(value),
                label: value === 0 ? t('textTools.freqShowAll') : t('textTools.freqShowTop', { count: value }),
              }))}
            />
          </label>
          {isWords && (
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-foreground">{t('textTools.freqMinLength')}</span>
              <Select
                value={String(minLength)}
                onChange={(e) => setMinLength(Number(e.target.value))}
                options={[1, 2, 3, 4].map((value) => ({
                  value: String(value),
                  label: value === 4 ? t('textTools.freqLenPlus', { count: value }) : String(value),
                }))}
              />
            </label>
          )}
          <div className="grid gap-2 self-end">
            <CheckboxRow
              checked={ignoreCase}
              onChange={setIgnoreCase}
              label={t('textTools.freqIgnoreCase')}
              hint={t('textTools.freqIgnoreCaseHint')}
            />
            {isWords && (
              <>
                <CheckboxRow
                  checked={ignoreStopWords}
                  onChange={setIgnoreStopWords}
                  label={t('textTools.freqIgnoreStopWords')}
                  hint={t(`textTools.freqStopHint_${result.language}` as never)}
                />
                <CheckboxRow
                  checked={includeNumbers}
                  onChange={setIncludeNumbers}
                  label={t('textTools.freqIncludeNumbers')}
                  hint={t('textTools.freqIncludeNumbersHint')}
                />
              </>
            )}
          </div>
        </div>
      </ToolPanel>

      <StatGrid
        columns={4}
        items={[
          {
            label: t(isWords ? 'textTools.freqWordsCounted' : 'textTools.freqCharsCounted'),
            value: result.total.toLocaleString(),
            accent: true,
          },
          { label: t('textTools.freqUnique'), value: result.unique.toLocaleString() },
          { label: t('textTools.freqOnce'), value: result.once.toLocaleString() },
          {
            label: t('textTools.freqCoverage'),
            value: `${result.topShare.toFixed(1)}%`,
            hint: t('textTools.freqCoverageHint'),
          },
        ]}
      />

      <ToolPanel
        title={t('textTools.freqTableTitle')}
        actions={
          <>
            <span className="text-xs text-muted-foreground">
              {result.total > result.entries.length
                ? t('textTools.freqShown', { shown: result.entries.length, total: result.unique })
                : ''}
            </span>
            <CopyButton value={csv} label={t('textTools.freqCopyTable')} />
            <TextDownloadButton
              value={csv}
              filename={isWords ? 'word-frequency.csv' : 'character-frequency.csv'}
              mime="text/csv;charset=utf-8"
              label={t('textTools.freqDownloadCsv')}
            />
            <CopyButton value={json} label={t('textTools.freqCopyJson')} variant="ghost" />
          </>
        }
      >
        {result.entries.length ? (
          <ol className="grid gap-1.5">
            {result.entries.map((entry, index) => (
              <li
                key={entry.term}
                className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-accent/40"
              >
                <span className="w-6 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span className="w-24 shrink-0 truncate font-medium text-foreground sm:w-36" title={entry.term}>
                  {entry.term}
                </span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${result.maxCount ? (entry.count / result.maxCount) * 100 : 0}%` }}
                  />
                </span>
                <span className="w-12 shrink-0 text-end tabular-nums text-muted-foreground">{entry.count}</span>
                <span className="w-14 shrink-0 text-end text-xs tabular-nums text-muted-foreground">
                  {entry.percent.toFixed(1)}%
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t('textTools.freqEmptyState')}</p>
        )}
      </ToolPanel>

      <PrivacyNotice />
    </div>
  );
}
