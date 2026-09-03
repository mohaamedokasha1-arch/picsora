'use client';

import * as React from 'react';
import { Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { containsArabic, convertCase, type CaseMode } from '@/lib/text-processing';
import { CopyButton, Notice, PrivacyNotice, ResetButton, TextArea, TextDownloadButton, ToolPanel } from '../kit';

const MODES: { mode: CaseMode; sample: string; caseless?: boolean }[] = [
  { mode: 'upper', sample: 'UPPERCASE' },
  { mode: 'lower', sample: 'lowercase' },
  { mode: 'title', sample: 'Title Case' },
  { mode: 'sentence', sample: 'Sentence case' },
  { mode: 'camel', sample: 'camelCase' },
  { mode: 'pascal', sample: 'PascalCase' },
  { mode: 'snake', sample: 'snake_case' },
  { mode: 'kebab', sample: 'kebab-case' },
  { mode: 'screamingSnake', sample: 'SCREAMING_SNAKE' },
  { mode: 'alternating', sample: 'aLtErNaTiNg' },
  { mode: 'inverse', sample: 'iNVERSE' },
];

/** Modes that still work on Arabic (no letter case involved). */
const ARABIC_SAFE: CaseMode[] = ['snake', 'kebab'];

export default function CaseConverterTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [original, setOriginal] = React.useState<string | null>(null);

  const arabic = React.useMemo(() => containsArabic(text), [text]);

  const apply = (mode: CaseMode) => {
    setOriginal((prev) => prev ?? text);
    setText((prev) => convertCase(prev, mode));
  };

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('textTools.input')}
        actions={
          <>
            {original !== null && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setText(original);
                  setOriginal(null);
                }}
              >
                <Undo2 className="h-3.5 w-3.5" />
                {t('textTools.revert')}
              </Button>
            )}
            <CopyButton value={text} />
            <TextDownloadButton value={text} filename="converted-text.txt" />
            <ResetButton
              onClick={() => {
                setText('');
                setOriginal(null);
              }}
              label={t('textTools.clear')}
            />
          </>
        }
      >
        <TextArea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOriginal(null);
          }}
          placeholder={t('textTools.typeOrPaste')}
          aria-label={t('textTools.input')}
          className="min-h-[220px] resize-y"
        />
      </ToolPanel>

      {arabic && <Notice>{t('textTools.arabicCaseNote')}</Notice>}

      <ToolPanel title={t('textTools.conversions')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {MODES.map(({ mode, sample }) => {
            const disabled = !text || (arabic && !ARABIC_SAFE.includes(mode));
            return (
              <Button
                key={mode}
                variant="outline"
                onClick={() => apply(mode)}
                disabled={disabled}
                title={disabled && arabic ? t('textTools.arabicCaseNote') : undefined}
                className="justify-start"
              >
                <span className="truncate">{t(`textTools.case_${mode}` as never)}</span>
                <span className="ms-auto hidden truncate font-mono text-[10px] text-muted-foreground sm:inline">
                  {sample}
                </span>
              </Button>
            );
          })}
        </div>
      </ToolPanel>

      <PrivacyNotice />
    </div>
  );
}
