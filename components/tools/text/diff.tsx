'use client';

import * as React from 'react';
import { Columns2, Rows2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { diffToText, diffWords, type DiffResult } from '@/lib/text-processing/diff';
import { CopyButton, PrivacyNotice, ResetButton, StatGrid, TextArea, ToolPanel } from '../kit';

export default function TextDiffTool() {
  const t = useTranslations();
  const [left, setLeft] = React.useState('');
  const [right, setRight] = React.useState('');
  const [stacked, setStacked] = React.useState(false);
  const [result, setResult] = React.useState<DiffResult | null>(null);

  const compare = () => setResult(diffWords(left, right));

  const reset = () => {
    setLeft('');
    setRight('');
    setResult(null);
  };

  return (
    <div className="space-y-5">
      <div className={cn('grid gap-5', stacked ? 'grid-cols-1' : 'lg:grid-cols-2')}>
        <ToolPanel title={t('textTools.originalText')}>
          <TextArea
            value={left}
            onChange={(e) => setLeft(e.target.value)}
            placeholder={t('textTools.typeOrPaste')}
            aria-label={t('textTools.originalText')}
            className="min-h-[240px] resize-y"
          />
        </ToolPanel>
        <ToolPanel title={t('textTools.modifiedText')}>
          <TextArea
            value={right}
            onChange={(e) => setRight(e.target.value)}
            placeholder={t('textTools.typeOrPaste')}
            aria-label={t('textTools.modifiedText')}
            className="min-h-[240px] resize-y"
          />
        </ToolPanel>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={compare} disabled={!left && !right}>
          {t('textTools.compare')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setStacked((v) => !v)}>
          {stacked ? <Columns2 className="h-3.5 w-3.5" /> : <Rows2 className="h-3.5 w-3.5" />}
          {stacked ? t('textTools.sideBySide') : t('textTools.stacked')}
        </Button>
        <ResetButton onClick={reset} />
      </div>

      {result && (
        <>
          <StatGrid
            items={[
              { label: t('textTools.linesAdded'), value: `+${result.stats.linesAdded}`, accent: true },
              { label: t('textTools.linesRemoved'), value: `−${result.stats.linesRemoved}` },
              { label: t('textTools.wordsAdded'), value: `+${result.stats.wordsAdded}` },
              { label: t('textTools.charactersChanged'), value: String(result.stats.charactersChanged) },
            ]}
          />

          <ToolPanel
            title={t('textTools.differences')}
            actions={<CopyButton value={diffToText(result.parts)} />}
          >
            <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-emerald-500/40" /> {t('textTools.added')}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-red-500/40" /> {t('textTools.removed')}
              </span>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-lg border border-border bg-secondary/20 p-4 font-mono text-[13px] leading-relaxed">
              {result.parts.length ? (
                result.parts.map((part, i) => (
                  <span
                    key={i}
                    className={cn(
                      'whitespace-pre-wrap',
                      part.op === 'insert' &&
                        'rounded-sm bg-emerald-500/20 text-emerald-800 dark:text-emerald-300',
                      part.op === 'delete' &&
                        'rounded-sm bg-red-500/20 text-red-800 line-through dark:text-red-300',
                    )}
                  >
                    {part.value}
                  </span>
                ))
              ) : (
                <span className="text-muted-foreground">{t('textTools.noDifferences')}</span>
              )}
            </div>
          </ToolPanel>
        </>
      )}

      <PrivacyNotice />
    </div>
  );
}
