'use client';

import * as React from 'react';
import { RotateCcw, RotateCw, RefreshCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard } from './common';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { rotateImage } from '@/lib/tools/processors/rotator';
import { cn } from '@/lib/utils';

export default function RotatorTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const [angle, setAngle] = React.useState(0);
  const decoded = ctx.decoded[0];
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Live preview.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decoded) return;
    const rad = (angle * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const nw = Math.round(decoded.width * cos + decoded.height * sin);
    const nh = Math.round(decoded.width * sin + decoded.height * cos);
    const scale = Math.min(1, 420 / Math.max(nw, nh));
    canvas.width = Math.round(nw * scale);
    canvas.height = Math.round(nh * scale);
    const cctx = canvas.getContext('2d');
    if (!cctx) return;
    cctx.clearRect(0, 0, canvas.width, canvas.height);
    cctx.translate(canvas.width / 2, canvas.height / 2);
    cctx.rotate(rad);
    cctx.scale(scale, scale);
    if (decoded.bitmap) cctx.drawImage(decoded.bitmap, -decoded.width / 2, -decoded.height / 2);
    else cctx.drawImage(decoded.image, -decoded.width / 2, -decoded.height / 2);
    cctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [angle, decoded]);

  const process = () => {
    run(() => rotateImage(ctx.decoded, { angle, format: decoded.format }));
  };

  const quick = (deg: number) => {
    const next = (angle + deg) % 360;
    setAngle(next < 0 ? next + 360 : next);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={() => quick(-90)} disabled={processing} title={t('controls.rotateLeft')}>
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => quick(180)} disabled={processing} title={t('controls.rotate180')}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => quick(90)} disabled={processing} title={t('controls.rotateRight')}>
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>
          <Slider
            label={t('controls.angle')}
            min={0}
            max={360}
            value={angle}
            onValueChange={setAngle}
            valueSuffix="°"
            disabled={processing}
          />
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.apply')}
          </Button>
        </ControlsCard>

        <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/40 p-4">
          <canvas ref={canvasRef} className={cn('max-w-full')} aria-label={t('toolShell.beforeAfter')} />
        </div>
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
