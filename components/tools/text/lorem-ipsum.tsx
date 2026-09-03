'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateLorem, splitWords, type LoremUnit } from '@/lib/text-processing';
import {
  CheckboxRow,
  CopyButton,
  Field,
  PrivacyNotice,
  StatGrid,
  TextArea,
  TextDownloadButton,
  ToggleGroup,
  ToolPanel,
} from '../kit';

const LIMITS: Record<LoremUnit, { min: number; max: number; initial: number }> = {
  words: { min: 1, max: 10000, initial: 50 },
  sentences: { min: 1, max: 1000, initial: 5 },
  paragraphs: { min: 1, max: 100, initial: 3 },
};

export default function LoremIpsumTool() {
  const t = useTranslations();
  const [unit, setUnit] = React.useState<LoremUnit>('paragraphs');
  const [count, setCount] = React.useState(3);
  const [startWithLorem, setStartWithLorem] = React.useState(true);
  const [html, setHtml] = React.useState(false);
  const [language, setLanguage] = React.useState<'latin' | 'arabic'>('latin');
  const [seed, setSeed] = React.useState(0);

  const limits = LIMITS[unit];
  const safeCount = Math.min(limits.max, Math.max(limits.min, Math.floor(count) || limits.min));

  const output = React.useMemo(() => {
    void seed; // regenerating bumps the seed to force new random text
    return generateLorem({ unit, count: safeCount, startWithLorem, html, language });
  }, [unit, safeCount, startWithLorem, html, language, seed]);

  const words = splitWords(output).length;

  return (
    <div className="space-y-5">
      <ToolPanel title={t('toolShell.settingsTitle')}>
        <div className="grid gap-5 md:grid-cols-2">
          <ToggleGroup
            label={t('textTools.generateBy')}
            value={unit}
            onChange={(value) => {
              setUnit(value);
              setCount(LIMITS[value].initial);
            }}
            options={[
              { value: 'words', label: t('textTools.unitWords') },
              { value: 'sentences', label: t('textTools.unitSentences') },
              { value: 'paragraphs', label: t('textTools.unitParagraphs') },
            ]}
          />
          <ToggleGroup
            label={t('textTools.language')}
            value={language}
            onChange={setLanguage}
            options={[
              { value: 'latin', label: t('textTools.latinLorem') },
              { value: 'arabic', label: t('textTools.arabicLorem') },
            ]}
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label={t('textTools.quantity', { min: limits.min, max: limits.max })}>
            <Input
              type="number"
              min={limits.min}
              max={limits.max}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </Field>
          <div className="space-y-1 self-end">
            <CheckboxRow checked={startWithLorem} onChange={setStartWithLorem} label={t('textTools.startWithLorem')} />
            <CheckboxRow checked={html} onChange={setHtml} label={t('textTools.htmlOutput')} />
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="h-4 w-4" />
            {t('textTools.generate')}
          </Button>
        </div>
      </ToolPanel>

      <ToolPanel
        title={t('textTools.output')}
        actions={
          <>
            <CopyButton value={output} />
            <TextDownloadButton value={output} filename={html ? 'lorem-ipsum.html' : 'lorem-ipsum.txt'} />
          </>
        }
      >
        <TextArea
          value={output}
          readOnly
          dir={language === 'arabic' ? 'rtl' : 'ltr'}
          aria-label={t('textTools.output')}
          className="min-h-[280px] resize-y bg-secondary/30"
        />
      </ToolPanel>

      <StatGrid
        columns={2}
        items={[
          { label: t('textTools.words'), value: words.toLocaleString() },
          { label: t('textTools.charsWithSpaces'), value: output.length.toLocaleString() },
        ]}
      />

      <PrivacyNotice />
    </div>
  );
}
