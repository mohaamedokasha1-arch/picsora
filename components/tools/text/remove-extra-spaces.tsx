'use client';

import * as React from 'react';
import { ArrowDownUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { defaultSpaceOptions, removeExtraSpaces, type SpaceOptions } from '@/lib/text-processing';
import {
  CheckboxRow,
  CopyButton,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextArea,
  TextDownloadButton,
  ToolPanel,
} from '../kit';

const OPTION_KEYS: (keyof SpaceOptions)[] = [
  'trimLeading',
  'trimTrailing',
  'collapseSpaces',
  'collapseBlankLines',
  'removeBlankLines',
  'tabsToSpaces',
  'removeAllWhitespace',
];

export default function RemoveExtraSpacesTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [options, setOptions] = React.useState<SpaceOptions>(defaultSpaceOptions);

  const output = React.useMemo(() => removeExtraSpaces(text, options), [text, options]);

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <ToolPanel title={t('textTools.options')}>
          <div className="space-y-1">
            {OPTION_KEYS.map((key) => (
              <CheckboxRow
                key={key}
                checked={options[key]}
                onChange={(checked) => setOptions((prev) => ({ ...prev, [key]: checked }))}
                label={t(`textTools.space_${key}` as never)}
              />
            ))}
          </div>
          <div className="mt-4">
            <ResetButton onClick={() => setOptions(defaultSpaceOptions)} label={t('textTools.resetOptions')} />
          </div>
        </ToolPanel>

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
              className="min-h-[220px] resize-y"
            />
          </ToolPanel>

          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setText(output)} disabled={!output || output === text}>
              <ArrowDownUp className="h-3.5 w-3.5" />
              {t('textTools.swapToInput')}
            </Button>
          </div>

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
              className="min-h-[220px] resize-y bg-secondary/30"
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
