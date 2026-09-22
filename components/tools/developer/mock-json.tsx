'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { MOCK_TEMPLATES, generateMock, type MockTemplate } from '@/lib/developer-tools/mock';
import {
  CodeArea,
  CopyButton,
  Field,
  PrivacyNotice,
  TextDownloadButton,
  ToolPanel,
} from '../kit';

/** Generate realistic mock JSON (users, products, posts…) with a stable seed. */
export default function MockJsonGeneratorTool() {
  const t = useTranslations();
  const [template, setTemplate] = React.useState<MockTemplate>('users');
  const [count, setCount] = React.useState(5);
  const [seed, setSeed] = React.useState(42);

  const json = React.useMemo(
    () => JSON.stringify(generateMock({ template, count, seed }), null, 2),
    [template, count, seed],
  );

  return (
    <div className="space-y-5">
      <PrivacyNotice scope="inputs" />
      <ToolPanel
        title={t('dev.mockOptions')}
        actions={
          <Button variant="outline" size="sm" onClick={() => setSeed(1 + Math.floor(Math.random() * 99999))}>
            {t('dev.mockShuffle')}
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-3 md:items-end">
          <Field label={t('dev.mockTemplate')}>
            <Select
              value={template}
              onChange={(e) => setTemplate(e.target.value as MockTemplate)}
              options={MOCK_TEMPLATES.map((m) => ({ value: m, label: t(`dev.mock_${m}` as never) }))}
            />
          </Field>
          <Slider label={t('dev.mockCount')} min={1} max={100} value={count} onValueChange={setCount} />
          <Field label={t('dev.mockSeed')}>
            <Input
              type="number"
              min={1}
              max={999999}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              dir="ltr"
            />
          </Field>
        </div>
      </ToolPanel>

      <ToolPanel
        title={t('dev.mockOutput')}
        actions={
          <>
            <CopyButton value={json} />
            <TextDownloadButton value={json} filename={`${template}.json`} mime="application/json" />
          </>
        }
      >
        <CodeArea value={json} readOnly ariaLabel={t('dev.mockOutput')} />
      </ToolPanel>
    </div>
  );
}
