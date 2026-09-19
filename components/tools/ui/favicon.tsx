'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox, Field } from './common';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

import { ActionButton } from '@/components/ui/action-button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { makeFavicon } from '@/lib/tools/processors/favicon';

/** Generate a complete favicon package (ICO + PNGs + manifest + ZIP). */
export default function FaviconTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [appName, setAppName] = React.useState('My App');
  const [apple, setApple] = React.useState(true);
  const [manifest, setManifest] = React.useState(true);
  const [zip, setZip] = React.useState(true);
  const preview = useObjectUrl(ctx.files[0]);

  const originalSize = ctx.files.reduce((sum, f) => sum + f.size, 0);

  const process = () => {
    run(() =>
      makeFavicon(ctx.decoded, {
        appleTouchIcon: apple,
        manifest,
        appName: appName.trim() || 'My App',
        zip,
      }),
    );
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Field label={t('favicon.appName')}>
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} disabled={processing} maxLength={60} />
          </Field>
          <Switch checked={apple} onCheckedChange={setApple} label={t('favicon.apple')} />
          <Switch checked={manifest} onCheckedChange={setManifest} label={t('favicon.manifest')} />
          <Switch checked={zip} onCheckedChange={setZip} label={t('favicon.zip')} />
          <ActionButton onClick={process} disabled={processing} processing={processing} success={results.length > 0 && !processing && !error} className="w-full">
            {t('favicon.generate')}
          </ActionButton>
        </ControlsCard>

        <PreviewBox src={preview} label={ctx.files[0]?.name} className="max-h-[420px]" />
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={originalSize} onReset={ctx.reset} />
    </div>
  );
}
