'use client';

import * as React from 'react';
import { FlipHorizontal2, FlipVertical2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, useObjectUrl, PreviewBox } from './common';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { flipImage } from '@/lib/tools/processors/flip';
import { cn } from '@/lib/utils';

function FlipTool({ ctx, direction }: { ctx: WorkspaceContext; direction: 'horizontal' | 'vertical' }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const preview = useObjectUrl(ctx.files[0]);

  const process = () => {
    run(() => flipImage(ctx.decoded, { direction, format: decoded.format }));
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {direction === 'horizontal' ? <FlipHorizontal2 className="h-4 w-4" /> : <FlipVertical2 className="h-4 w-4" />}
            {direction === 'horizontal' ? t('controls.flipHorizontal') : t('controls.flipVertical')}
          </Button>
        </ControlsCard>
        <PreviewBox
          src={preview}
          label={ctx.files[0]?.name}
          className={cn('max-h-[420px]', direction === 'horizontal' && '-scale-x-100')}
        />
      </div>
      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}

export function FlipHorizontalTool({ ctx }: { ctx: WorkspaceContext }) {
  return <FlipTool ctx={ctx} direction="horizontal" />;
}

export function FlipVerticalTool({ ctx }: { ctx: WorkspaceContext }) {
  return <FlipTool ctx={ctx} direction="vertical" />;
}
