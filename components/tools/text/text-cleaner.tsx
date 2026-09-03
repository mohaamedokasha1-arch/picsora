'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { cleanText, defaultCleanOptions, type CleanOptions } from '@/lib/text-processing';
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

type BoolKey = {
  [K in keyof CleanOptions]: CleanOptions[K] extends boolean ? K : never;
}[keyof CleanOptions];

const GROUPS: { title: string; keys: BoolKey[] }[] = [
  { title: 'groupCharacters', keys: ['stripHtml', 'removeUrls', 'removeEmails', 'removePhones', 'removeNumbers', 'removePunctuation', 'removeSpecial', 'removeEmoji'] },
  { title: 'groupLines', keys: ['removeLineBreaks', 'removeDuplicateLines', 'sortLines', 'reverseLines'] },
];

export default function TextCleanerTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [options, setOptions] = React.useState<CleanOptions>(defaultCleanOptions);

  const output = React.useMemo(() => cleanText(text, options), [text, options]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          {GROUPS.map((group) => (
            <ToolPanel key={group.title} title={t(`textTools.${group.title}` as never)}>
              <div className="space-y-1">
                {group.keys.map((key) => (
                  <CheckboxRow
                    key={key}
                    checked={options[key]}
                    onChange={(checked) => setOptions((prev) => ({ ...prev, [key]: checked }))}
                    label={t(`textTools.clean_${key}` as never)}
                  />
                ))}
              </div>
            </ToolPanel>
          ))}

          <ToolPanel title={t('textTools.groupFindReplace')}>
            <div className="space-y-3">
              <Field label={t('textTools.removeLinesContaining')}>
                <Input
                  value={options.removeLinesContaining}
                  onChange={(e) => setOptions((prev) => ({ ...prev, removeLinesContaining: e.target.value }))}
                />
              </Field>
              <Field label={t('textTools.find')}>
                <Input
                  value={options.find}
                  onChange={(e) => setOptions((prev) => ({ ...prev, find: e.target.value }))}
                />
              </Field>
              <Field label={t('textTools.replaceWith')}>
                <Input
                  value={options.replace}
                  onChange={(e) => setOptions((prev) => ({ ...prev, replace: e.target.value }))}
                />
              </Field>
            </div>
            <div className="mt-4">
              <ResetButton onClick={() => setOptions(defaultCleanOptions)} label={t('textTools.resetOptions')} />
            </div>
          </ToolPanel>
        </div>

        <div className="space-y-4">
          <ToolPanel
            title={t('textTools.input')}
            actions={<ResetButton onClick={() => setText('')} label={t('textTools.clear')} />}
          >
            <TextArea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('textTools.typeOrPaste')}
              aria-label={t('textTools.input')}
              className="min-h-[240px] resize-y"
            />
          </ToolPanel>

          <ToolPanel
            title={t('textTools.output')}
            actions={
              <>
                <CopyButton value={output} />
                <TextDownloadButton value={output} filename="cleaned-text.txt" />
              </>
            }
          >
            <TextArea
              value={output}
              readOnly
              aria-label={t('textTools.output')}
              className="min-h-[240px] resize-y bg-secondary/30"
            />
          </ToolPanel>
        </div>
      </div>

      <StatGrid
        columns={3}
        items={[
          { label: t('textTools.beforeChars'), value: text.length.toLocaleString() },
          { label: t('textTools.afterChars'), value: output.length.toLocaleString() },
          {
            label: t('textTools.removedChars'),
            value: Math.max(0, text.length - output.length).toLocaleString(),
            accent: true,
          },
        ]}
      />

      <PrivacyNotice />
    </div>
  );
}
