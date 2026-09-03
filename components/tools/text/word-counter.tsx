'use client';

import * as React from 'react';
import { ClipboardPaste, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { analyzeText } from '@/lib/text-processing';
import { PrivacyNotice, ResetButton, StatGrid, TextArea, ToggleGroup, ToolPanel, useDebounced, useTextFileInput } from '../kit';

export default function WordCounterTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [stopLang, setStopLang] = React.useState<'en' | 'ar'>('en');
  const debounced = useDebounced(text, 300);
  const { input, open } = useTextFileInput(setText);

  const stats = React.useMemo(() => analyzeText(debounced, stopLang), [debounced, stopLang]);

  const minutes = (value: number) => {
    if (value <= 0) return '0:00';
    const total = Math.round(value * 60);
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  };

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      /* clipboard read may be denied — the user can paste manually */
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
          placeholder={t('textTools.typeOrPaste')}
          aria-label={t('textTools.yourText')}
          className="min-h-[300px] resize-y"
        />
      </ToolPanel>

      <StatGrid
        items={[
          { label: t('textTools.charsWithSpaces'), value: stats.charactersWithSpaces.toLocaleString(), accent: true },
          { label: t('textTools.charsNoSpaces'), value: stats.charactersWithoutSpaces.toLocaleString() },
          { label: t('textTools.words'), value: stats.words.toLocaleString(), accent: true },
          { label: t('textTools.sentences'), value: stats.sentences.toLocaleString() },
          { label: t('textTools.paragraphs'), value: stats.paragraphs.toLocaleString() },
          { label: t('textTools.lines'), value: stats.lines.toLocaleString() },
          { label: t('textTools.uniqueWords'), value: stats.uniqueWords.toLocaleString() },
          {
            label: t('textTools.readingTime'),
            value: minutes(stats.readingMinutes),
            hint: t('textTools.readingHint'),
          },
          {
            label: t('textTools.speakingTime'),
            value: minutes(stats.speakingMinutes),
            hint: t('textTools.speakingHint'),
          },
        ]}
      />

      <ToolPanel
        title={t('textTools.topWords')}
        actions={
          <ToggleGroup
            value={stopLang}
            onChange={setStopLang}
            options={[
              { value: 'en', label: t('textTools.stopEn') },
              { value: 'ar', label: t('textTools.stopAr') },
            ]}
          />
        }
      >
        {stats.frequencies.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {stats.frequencies.map((entry) => {
              const max = stats.frequencies[0].count;
              return (
                <li key={entry.word} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 truncate text-sm text-foreground" title={entry.word}>
                    {entry.word}
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <span
                      className="block h-full rounded-full bg-primary"
                      style={{ width: `${(entry.count / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-end text-sm tabular-nums text-muted-foreground">
                    {entry.count}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('textTools.noWordsYet')}</p>
        )}
      </ToolPanel>

      <PrivacyNotice />
    </div>
  );
}
