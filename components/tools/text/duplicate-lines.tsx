'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { removeDuplicateLines, type DedupeOptions } from '@/lib/text-processing';
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
} from '../kit';

export default function DuplicateLinesTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [options, setOptions] = React.useState<DedupeOptions>({ caseSensitive: false, trim: true, keep: 'first' });

  const result = React.useMemo(() => removeDuplicateLines(text, options), [text, options]);

  return (
    <div className="space-y-5">
      <ToolPanel title={t('textTools.options')}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <CheckboxRow
              checked={options.caseSensitive}
              onChange={(checked) => setOptions((prev) => ({ ...prev, caseSensitive: checked }))}
              label={t('textTools.caseSensitive')}
            />
            <CheckboxRow
              checked={options.trim}
              onChange={(checked) => setOptions((prev) => ({ ...prev, trim: checked }))}
              label={t('textTools.trimBeforeCompare')}
            />
          </div>
          <ToggleGroup
            label={t('textTools.keepOccurrence')}
            value={options.keep}
            onChange={(keep) => setOptions((prev) => ({ ...prev, keep }))}
            options={[
              { value: 'first', label: t('textTools.keepFirst') },
              { value: 'last', label: t('textTools.keepLast') },
            ]}
          />
        </div>
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title={t('textTools.input')}
          actions={<ResetButton onClick={() => setText('')} label={t('textTools.clear')} />}
        >
          <TextArea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('textTools.linesPlaceholder')}
            aria-label={t('textTools.input')}
            className="min-h-[260px] resize-y"
          />
        </ToolPanel>

        <ToolPanel
          title={t('textTools.output')}
          actions={
            <>
              <CopyButton value={result.text} />
              <TextDownloadButton value={result.text} filename="unique-lines.txt" />
            </>
          }
        >
          <TextArea
            value={result.text}
            readOnly
            aria-label={t('textTools.output')}
            className="min-h-[260px] resize-y bg-secondary/30"
          />
        </ToolPanel>
      </div>

      <StatGrid
        columns={3}
        items={[
          { label: t('textTools.linesBefore'), value: (text ? result.before : 0).toLocaleString() },
          { label: t('textTools.linesAfter'), value: (text ? result.after : 0).toLocaleString() },
          { label: t('textTools.linesRemoved'), value: (text ? result.removed : 0).toLocaleString(), accent: true },
        ]}
      />

      <PrivacyNotice />
    </div>
  );
}
