'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { slugify, type SlugOptions } from '@/lib/text-processing';
import { CheckboxRow, CopyButton, Field, PrivacyNotice, ResetButton, ToggleGroup, ToolPanel } from '../kit';

export default function SlugTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [options, setOptions] = React.useState<SlugOptions>({
    separator: '-',
    uppercase: false,
    transliterate: true,
    removeStopWords: false,
  });

  const slug = React.useMemo(() => slugify(text, options), [text, options]);

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('textTools.input')}
        actions={<ResetButton onClick={() => setText('')} label={t('textTools.clear')} />}
      >
        <Field label={t('textTools.titleOrText')}>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('textTools.slugPlaceholder')}
          />
        </Field>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <ToggleGroup
            label={t('textTools.separator')}
            value={options.separator}
            onChange={(separator) => setOptions((prev) => ({ ...prev, separator }))}
            options={[
              { value: '-', label: t('textTools.hyphen') },
              { value: '_', label: t('textTools.underscore') },
            ]}
          />
          <ToggleGroup
            label={t('textTools.letterCase')}
            value={options.uppercase ? 'upper' : 'lower'}
            onChange={(value) => setOptions((prev) => ({ ...prev, uppercase: value === 'upper' }))}
            options={[
              { value: 'lower', label: t('textTools.case_lower') },
              { value: 'upper', label: t('textTools.case_upper') },
            ]}
          />
        </div>

        <div className="mt-4 space-y-1">
          <CheckboxRow
            checked={options.transliterate}
            onChange={(transliterate) => setOptions((prev) => ({ ...prev, transliterate }))}
            label={t('textTools.transliterate')}
            hint={t('textTools.transliterateHint')}
          />
          <CheckboxRow
            checked={options.removeStopWords}
            onChange={(removeStopWords) => setOptions((prev) => ({ ...prev, removeStopWords }))}
            label={t('textTools.removeStopWords')}
            hint={t('textTools.removeStopWordsHint')}
          />
        </div>
      </ToolPanel>

      <ToolPanel title={t('textTools.generatedSlug')} actions={<CopyButton value={slug} />}>
        <div className="rounded-lg border border-border bg-secondary/40 p-4">
          <code dir="ltr" className="block break-all font-mono text-base text-foreground">
            {slug || t('textTools.slugEmpty')}
          </code>
        </div>
        {slug && (
          <p dir="ltr" className="mt-2 break-all text-xs text-muted-foreground">
            https://example.com/{slug}
          </p>
        )}
      </ToolPanel>

      <PrivacyNotice />
    </div>
  );
}
