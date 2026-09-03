'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatId, generateIds, validateUuid, type IdKind } from '@/lib/developer-tools/ids';
import {
  CheckboxRow,
  CopyButton,
  Field,
  Notice,
  PrivacyNotice,
  ResetButton,
  TextDownloadButton,
  ToggleGroup,
  ToolPanel,
} from '../kit';

const KINDS: IdKind[] = ['uuidv4', 'uuidv1', 'ulid', 'nanoid'];

export default function UuidGeneratorTool() {
  const t = useTranslations();
  const [kind, setKind] = React.useState<IdKind>('uuidv4');
  const [count, setCount] = React.useState(5);
  const [nanoSize, setNanoSize] = React.useState(21);
  const [hyphens, setHyphens] = React.useState(true);
  const [uppercase, setUppercase] = React.useState(false);
  const [braces, setBraces] = React.useState(false);
  const [ids, setIds] = React.useState<string[]>([]);
  const [check, setCheck] = React.useState('');

  const generate = React.useCallback(() => {
    setIds(generateIds(kind, count, nanoSize));
  }, [kind, count, nanoSize]);

  React.useEffect(() => {
    generate();
  }, [generate]);

  const formatted = React.useMemo(
    () =>
      ids.map((id) =>
        kind === 'nanoid' || kind === 'ulid'
          ? uppercase
            ? id.toUpperCase()
            : id
          : formatId(id, { hyphens, uppercase, braces }),
      ),
    [ids, kind, hyphens, uppercase, braces],
  );

  const validation = check.trim() ? validateUuid(check) : null;

  return (
    <div className="space-y-5">
      <ToolPanel
        title={t('toolShell.settingsTitle')}
        actions={<ResetButton onClick={() => { setCount(5); setKind('uuidv4'); }} />}
      >
        <ToggleGroup
          label={t('dev.idType')}
          value={kind}
          onChange={setKind}
          options={KINDS.map((value) => ({ value, label: t(`dev.id_${value}` as never) }))}
        />

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('dev.howMany')}>
            <Input
              type="number"
              min={1}
              max={1000}
              value={count}
              onChange={(e) => setCount(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))}
              dir="ltr"
            />
          </Field>
          {kind === 'nanoid' && (
            <Field label={t('dev.nanoLength')}>
              <Input
                type="number"
                min={4}
                max={64}
                value={nanoSize}
                onChange={(e) => setNanoSize(Math.min(64, Math.max(4, Number(e.target.value) || 21)))}
                dir="ltr"
              />
            </Field>
          )}
          <div className="space-y-1 self-end">
            {kind !== 'nanoid' && kind !== 'ulid' && (
              <>
                <CheckboxRow checked={hyphens} onChange={setHyphens} label={t('dev.withHyphens')} />
                <CheckboxRow checked={braces} onChange={setBraces} label={t('dev.withBraces')} />
              </>
            )}
            <CheckboxRow checked={uppercase} onChange={setUppercase} label={t('dev.uppercase')} />
          </div>
        </div>

        <div className="mt-4">
          <Button onClick={generate}>
            <RefreshCw className="h-4 w-4" />
            {t('dev.generate')}
          </Button>
        </div>
      </ToolPanel>

      <ToolPanel
        title={t('dev.generatedIds', { count: formatted.length })}
        actions={
          <>
            <CopyButton value={formatted.join('\n')} label={t('dev.copyAll')} />
            <TextDownloadButton value={formatted.join('\n')} filename="ids.txt" />
          </>
        }
      >
        <ul className="max-h-[380px] space-y-1.5 overflow-y-auto">
          {formatted.map((id, i) => (
            <li
              key={`${id}-${i}`}
              className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary/30 px-3 py-1.5"
            >
              <code dir="ltr" className="min-w-0 truncate font-mono text-[13px] text-foreground">
                {id}
              </code>
              <CopyButton value={id} size="icon-sm" variant="ghost" />
            </li>
          ))}
        </ul>
      </ToolPanel>

      <ToolPanel title={t('dev.validator')}>
        <Field label={t('dev.validateLabel')}>
          <Input
            value={check}
            onChange={(e) => setCheck(e.target.value)}
            placeholder="123e4567-e89b-12d3-a456-426614174000"
            dir="ltr"
            className="font-mono"
          />
        </Field>
        {validation && (
          <p className={`mt-3 text-sm font-medium ${validation.valid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {validation.valid
              ? validation.kind === 'ulid'
                ? t('dev.validUlid')
                : t('dev.validUuid', { version: validation.version ?? 0, variant: validation.variant ?? '' })
              : t('dev.invalidUuid')}
          </p>
        )}
      </ToolPanel>

      <Notice>{t('dev.uuidHint')}</Notice>
      <PrivacyNotice />
    </div>
  );
}
