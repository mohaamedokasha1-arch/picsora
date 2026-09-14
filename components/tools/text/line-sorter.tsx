'use client';

import * as React from 'react';
import { ClipboardPaste, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { SORT_MODES, sortLines, type SortMode } from '@/lib/text-processing/sort-lines';
import {
  CheckboxRow,
  CopyButton,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextArea,
  TextDownloadButton,
  ToolPanel,
  useTextFileInput,
} from '../kit';

export default function LineSorterTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [mode, setMode] = React.useState<SortMode>('az');
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [trim, setTrim] = React.useState(true);
  const [removeEmpty, setRemoveEmpty] = React.useState(true);
  const [removeDuplicates, setRemoveDuplicates] = React.useState(false);
  const { input, open } = useTextFileInput(setText);

  // Random shuffle must not re-run on every keystroke of an unrelated option,
  // so the result is memoised on the exact inputs that change it.
  const result = React.useMemo(
    () => sortLines(text, { mode, caseSensitive, trim, removeEmpty, removeDuplicates }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, mode, caseSensitive, trim, removeEmpty, removeDuplicates],
  );

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      /* clipboard may be blocked — manual paste still works */
    }
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
            <ResetButton onClick={() => setText('')} label={t('textTools.clear')} />
          </>
        }
      >
        <TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('textTools.oneLinePerItem')}
          aria-label={t('textTools.yourText')}
          className="min-h-[220px] resize-y"
        />
      </ToolPanel>

      <ToolPanel title={t('textTools.sortOptions')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">{t('textTools.sortOrder')}</span>
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as SortMode)}
              options={SORT_MODES.map((value) => ({ value, label: t(`textTools.sort_${value}` as never) }))}
            />
          </label>
          <div className="grid gap-2 self-end">
            <CheckboxRow checked={trim} onChange={setTrim} label={t('textTools.trimLines')} />
            <CheckboxRow checked={removeEmpty} onChange={setRemoveEmpty} label={t('textTools.removeEmptyLines')} />
            <CheckboxRow
              checked={removeDuplicates}
              onChange={setRemoveDuplicates}
              label={t('textTools.removeDuplicates')}
            />
            <CheckboxRow
              checked={caseSensitive}
              onChange={setCaseSensitive}
              label={t('textTools.caseSensitive')}
            />
          </div>
        </div>
      </ToolPanel>

      <ToolPanel
        title={t('textTools.sortedResult')}
        actions={
          <>
            <CopyButton value={result.text} label={t('common.copy')} />
            <TextDownloadButton value={result.text} filename="sorted-lines.txt" />
          </>
        }
      >
        {result.text ? (
          <TextArea
            value={result.text}
            readOnly
            mono
            aria-label={t('textTools.sortedResult')}
            className="min-h-[220px] resize-y bg-secondary/30"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t('textTools.emptyState')}</p>
        )}
      </ToolPanel>

      <StatGrid
        columns={4}
        items={[
          { label: t('textTools.linesIn'), value: result.linesIn.toLocaleString() },
          { label: t('textTools.linesOut'), value: result.linesOut.toLocaleString(), accent: true },
          { label: t('textTools.duplicatesRemoved'), value: result.duplicatesRemoved.toLocaleString() },
          { label: t('textTools.emptyRemoved'), value: result.emptyRemoved.toLocaleString() },
        ]}
      />

      <PrivacyNotice text={t('common.allProcessingText')} />
    </div>
  );
}
