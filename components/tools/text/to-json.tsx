'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { linesToJson } from '@/lib/text-processing/lines-convert';
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

/** Convert plain-text lines into a JSON array — locally, live. */
export default function TextToJsonTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [skipEmpty, setSkipEmpty] = React.useState(true);
  const [trim, setTrim] = React.useState(true);
  const [smartTypes, setSmartTypes] = React.useState(true);

  const result = React.useMemo(
    () => linesToJson(text, { skipEmpty, trim, smartTypes }),
    [text, skipEmpty, trim, smartTypes],
  );

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <ToolPanel title={t('textTools.options')}>
        <div className="grid gap-4 md:grid-cols-3">
          <CheckboxRow checked={skipEmpty} onChange={setSkipEmpty} label={t('textTools.skipEmpty')} />
          <CheckboxRow checked={trim} onChange={setTrim} label={t('textTools.trimLines')} />
          <CheckboxRow checked={smartTypes} onChange={setSmartTypes} label={t('textTools.smartTypes')} />
        </div>
      </ToolPanel>

      {text.trim() && (
        <StatGrid
          columns={2}
          items={[
            { label: t('textTools.linesCount'), value: String(result.count), accent: true },
            { label: t('textTools.outputSize'), value: `${(result.json.length / 1024).toFixed(1)} KB` },
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
            placeholder={t('textTools.linesPlaceholder')}
            aria-label={t('textTools.input')}
            className="min-h-[260px] resize-y"
          />
        </ToolPanel>

        <ToolPanel
          title={t('textTools.output')}
          actions={
            <>
              <CopyButton value={result.json} />
              <TextDownloadButton value={result.json} filename="lines.json" mime="application/json" />
            </>
          }
        >
          <TextArea
            value={result.json}
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
