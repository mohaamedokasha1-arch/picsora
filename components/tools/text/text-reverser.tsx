'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { reverseText, type ReverseMode } from '@/lib/text-processing';
import { CopyButton, PrivacyNotice, ResetButton, TextArea, TextDownloadButton, ToggleGroup, ToolPanel } from '../kit';

const MODES: ReverseMode[] = ['characters', 'words', 'eachLine', 'lineOrder'];

export default function TextReverserTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [mode, setMode] = React.useState<ReverseMode>('characters');

  const output = React.useMemo(() => reverseText(text, mode), [text, mode]);

  return (
    <div className="space-y-5">
      <ToolPanel title={t('textTools.reverseMode')}>
        <ToggleGroup
          value={mode}
          onChange={setMode}
          options={MODES.map((value) => ({ value, label: t(`textTools.reverse_${value}` as never) }))}
        />
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-2">
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
              <TextDownloadButton value={output} filename="reversed-text.txt" />
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

      <PrivacyNotice />
    </div>
  );
}
