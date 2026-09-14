'use client';

import * as React from 'react';
import { ClipboardPaste, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { EXTRACT_KINDS, extractItems, type ExtractKind } from '@/lib/text-processing/extract';
import {
  CheckboxRow,
  CopyButton,
  PrivacyNotice,
  ResetButton,
  StatGrid,
  TextArea,
  TextDownloadButton,
  ToolPanel,
  useDebounced,
  useTextFileInput,
} from '../kit';

export default function TextExtractorTool() {
  const t = useTranslations();
  const [text, setText] = React.useState('');
  const [kinds, setKinds] = React.useState<Record<ExtractKind, boolean>>({
    urls: true,
    emails: true,
    phones: true,
    numbers: false,
  });
  const [unique, setUnique] = React.useState(true);
  const debounced = useDebounced(text, 250);
  const { input, open } = useTextFileInput(setText);

  const result = React.useMemo(() => extractItems(debounced, { kinds, unique }), [debounced, kinds, unique]);

  const allItems = result.groups.flatMap((group) => group.items);
  const downloadText = allItems.join('\n');
  const groupedText = result.groups
    .map((group) => `# ${group.kind}\n${group.items.join('\n')}`)
    .join('\n\n');

  const paste = async () => {
    try {
      setText(await navigator.clipboard.readText());
    } catch {
      /* clipboard may be blocked — manual paste still works */
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
          placeholder={t('textTools.extractPlaceholder')}
          aria-label={t('textTools.yourText')}
          className="min-h-[200px] resize-y"
        />
      </ToolPanel>

      <ToolPanel title={t('textTools.whatToExtract')}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EXTRACT_KINDS.map((kind) => (
            <CheckboxRow
              key={kind}
              checked={kinds[kind]}
              onChange={(checked) => setKinds((prev) => ({ ...prev, [kind]: checked }))}
              label={t(`textTools.kind_${kind}` as never)}
            />
          ))}
          <CheckboxRow checked={unique} onChange={setUnique} label={t('textTools.uniqueOnly')} />
        </div>
      </ToolPanel>

      <StatGrid
        columns={3}
        items={[
          { label: t('textTools.itemsFound'), value: result.total.toLocaleString(), accent: true },
          { label: t('textTools.kindsSelected'), value: String(Object.values(kinds).filter(Boolean).length) },
          { label: t('textTools.charactersFound'), value: result.characters.toLocaleString() },
        ]}
      />

      {result.groups.map((group) => (
        <ToolPanel
          key={group.kind}
          title={`${t(`textTools.kind_${group.kind}` as never)} (${group.items.length})`}
          actions={
            group.items.length > 0 ? (
              <>
                <CopyButton value={group.items.join('\n')} />
                <TextDownloadButton value={group.items.join('\n')} filename={`${group.kind}.txt`} />
              </>
            ) : undefined
          }
        >
          {group.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('textTools.nothingFound')}</p>
          ) : (
            <ul className="max-h-[280px] space-y-1 overflow-auto" dir="ltr">
              {group.items.map((item, i) => (
                <li key={`${item}-${i}`} className="truncate rounded bg-secondary/40 px-2 py-1 font-mono text-[13px] text-foreground" title={item}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </ToolPanel>
      ))}

      {result.total > 0 && (
        <div className="flex flex-wrap gap-2">
          <CopyButton value={groupedText} label={t('textTools.copyAllGroups')} size="default" />
          <TextDownloadButton value={downloadText} filename="extracted.txt" label={t('textTools.downloadAllItems')} size="default" />
        </div>
      )}

      <PrivacyNotice text={t('common.allProcessingText')} />
    </div>
  );
}
