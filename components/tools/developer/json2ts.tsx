'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { jsonToTypeScript } from '@/lib/developer-tools/json2ts';
import {
  CheckboxRow,
  CodeArea,
  CopyButton,
  Field,
  InlineError,
  PrivacyNotice,
  ResetButton,
  TextDownloadButton,
  ToolPanel,
  useDebounced,
} from '../kit';

const SAMPLE = '{\n  "id": 1,\n  "name": "Layla Hassan",\n  "email": "layla@example.com",\n  "tags": ["admin", "editor"],\n  "address": {\n    "city": "Cairo",\n    "zip": "11511"\n  },\n  "deletedAt": null\n}';

/** Infer TypeScript interfaces from a JSON document — locally, live. */
export default function JsonToTsTool() {
  const t = useTranslations();
  const [input, setInput] = React.useState(SAMPLE);
  const [rootName, setRootName] = React.useState('Root');
  const [exported, setExported] = React.useState(true);
  const [optionalNulls, setOptionalNulls] = React.useState(true);
  const debounced = useDebounced(input, 300);

  const result = React.useMemo(
    () => jsonToTypeScript(debounced, { rootName, exported, optionalNulls }),
    [debounced, rootName, exported, optionalNulls],
  );

  return (
    <div className="space-y-5">
      <PrivacyNotice />
      <ToolPanel title={t('textTools.options')}>
        <div className="grid gap-4 md:grid-cols-3 md:items-end">
          <Field label={t('dev.tsRootName')}>
            <Input value={rootName} onChange={(e) => setRootName(e.target.value)} maxLength={40} dir="ltr" />
          </Field>
          <CheckboxRow checked={exported} onChange={setExported} label={t('dev.tsExported')} />
          <CheckboxRow checked={optionalNulls} onChange={setOptionalNulls} label={t('dev.tsOptionalNulls')} />
        </div>
      </ToolPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <ToolPanel
          title={t('dev.jsonInput')}
          actions={<ResetButton onClick={() => setInput('')} label={t('textTools.clear')} />}
        >
          <CodeArea
            value={input}
            onChange={setInput}
            ariaLabel={t('dev.jsonInput')}
            placeholder='{"key": "value"}'
          />
        </ToolPanel>
        <ToolPanel
          title={t('dev.tsOutput')}
          actions={
            <>
              <CopyButton value={result.code ?? ''} />
              <TextDownloadButton value={result.code ?? ''} filename="types.ts" mime="text/plain;charset=utf-8" />
            </>
          }
        >
          {!result.ok ? (
            <InlineError
              message={
                result.error === 'parse'
                  ? t('errors.jsonParse')
                  : result.error === 'too-large'
                    ? t('errors.jsonTooLarge')
                    : t('dev.tsEmpty')
              }
            />
          ) : (
            <CodeArea value={result.code ?? ''} readOnly ariaLabel={t('dev.tsOutput')} />
          )}
        </ToolPanel>
      </div>
    </div>
  );
}
