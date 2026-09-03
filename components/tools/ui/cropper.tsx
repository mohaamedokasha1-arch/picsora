'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { useToolRunner } from './use-tool';
import { ControlsCard, Field, useObjectUrl } from './common';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ErrorDisplay } from '@/components/tools/error-display';
import { ProcessingIndicator } from '@/components/tools/processing-indicator';
import { ResultPanel } from '@/components/tools/result-panel';
import { cropImage } from '@/lib/tools/processors/cropper';
import { cn } from '@/lib/utils';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const RATIOS: Record<string, number | null> = {
  free: null,
  '1:1': 1,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
  '3:2': 3 / 2,
  '9:16': 9 / 16,
};

type DragState = { mode: 'move' | 'resize'; corner?: string; startX: number; startY: number; startBox: Box };

export default function CropperTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const { processing, results, error, run } = useToolRunner();
  const decoded = ctx.decoded[0];
  const imgUrl = useObjectUrl(ctx.files[0]);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);
  const [ratio, setRatio] = React.useState<string>('free');
  const [box, setBox] = React.useState<Box>({ x: 0, y: 0, w: 0, h: 0 });
  const drag = React.useRef<DragState | null>(null);

  // Fit image into container and init crop box.
  React.useEffect(() => {
    if (!decoded) return;
    const el = wrapRef.current;
    if (!el) return;
    const maxW = el.clientWidth || 640;
    const s = Math.min(1, maxW / decoded.width);
    setScale(s);
    const w = Math.round(decoded.width * 0.86);
    const h = Math.round(decoded.height * 0.86);
    setBox({ x: Math.round((decoded.width - w) / 2), y: Math.round((decoded.height - h) / 2), w, h });
  }, [decoded]);

  const clampBox = (b: Box): Box => {
    if (!decoded) return b;
    const min = 24 / scale;
    const w = Math.max(min, Math.min(decoded.width - b.x, b.w));
    const h = Math.max(min, Math.min(decoded.height - b.y, b.h));
    return {
      x: Math.max(0, Math.min(decoded.width - min, b.x)),
      y: Math.max(0, Math.min(decoded.height - min, b.y)),
      w,
      h,
    };
  };

  const onPointerDown = (e: React.PointerEvent, mode: DragState['mode'], corner?: string) => {
    if (!decoded) return;
    e.preventDefault();
    drag.current = { mode, corner, startX: e.clientX, startY: e.clientY, startBox: { ...box } };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d || !decoded) return;
      const dx = (ev.clientX - d.startX) / scale;
      const dy = (ev.clientY - d.startY) / scale;
      let next: Box = { ...d.startBox };
      const r = RATIOS[ratio];

      if (d.mode === 'move') {
        next.x = clampBox({ ...next, x: d.startBox.x + dx, y: d.startBox.y + dy }).x;
        next.y = clampBox({ ...next, x: d.startBox.x + dx, y: d.startBox.y + dy }).y;
      } else {
        // Resize from a corner (opposite corner stays fixed).
        const cx = d.corner?.includes('e') ? 'e' : 'w';
        const cy = d.corner?.includes('s') ? 's' : 'n';
        const anchorX = cx === 'e' ? d.startBox.x : d.startBox.x + d.startBox.w;
        const anchorY = cy === 's' ? d.startBox.y : d.startBox.y + d.startBox.h;
        let px = cx === 'e' ? d.startBox.x + d.startBox.w + dx : d.startBox.x + dx;
        let py = cy === 's' ? d.startBox.y + d.startBox.h + dy : d.startBox.y + dy;
        let w = Math.abs(px - anchorX);
        let h = Math.abs(py - anchorY);
        if (r) {
          const derived = Math.max(w, h / r, r * h >= w ? h * r : w);
          if (w >= h) {
            w = Math.max(w, h * r);
            h = w / r;
          } else {
            h = Math.max(h, w / r);
            w = h * r;
          }
        }
        const nx = cx === 'e' ? anchorX : anchorX - w;
        const ny = cy === 's' ? anchorY : anchorY - h;
        next = clampBox({ x: nx, y: ny, w, h });
      }
      setBox(next);
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const process = () => {
    const b = clampBox(box);
    run(() =>
      cropImage(ctx.decoded, {
        x: Math.round(b.x),
        y: Math.round(b.y),
        width: Math.round(b.w),
        height: Math.round(b.h),
        format: decoded.format,
      }),
    );
  };

  const dw = Math.round(box.w * scale);
  const dh = Math.round(box.h * scale);
  const dx = box.x * scale;
  const dy = box.y * scale;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        <ControlsCard>
          <h3 className="text-sm font-semibold text-foreground">{t('toolShell.settingsTitle')}</h3>
          <Field label={t('controls.aspectRatio')}>
            <Select
              value={ratio}
              onChange={(e) => setRatio(e.target.value)}
              disabled={processing}
              options={Object.keys(RATIOS).map((k) => ({ value: k, label: k === 'free' ? t('controls.free') : k }))}
            />
          </Field>
          <p className="text-xs text-muted-foreground">
            {t('controls.cropDimensions')}: {Math.round(box.w)} × {Math.round(box.h)} px
          </p>
          <Button onClick={process} disabled={processing} loading={processing} className="w-full">
            {t('controls.crop')}
          </Button>
        </ControlsCard>

        <div
          ref={wrapRef}
          className="relative overflow-hidden rounded-xl border border-border bg-secondary/40"
          style={{ touchAction: 'none' }}
        >
          <div className="relative mx-auto" style={{ width: decoded ? decoded.width * scale : '100%' }}>
            {imgUrl && decoded && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imgUrl}
                alt={ctx.files[0]?.name}
                width={decoded.width * scale}
                height={decoded.height * scale}
                className="block select-none"
                draggable={false}
              />
            )}
            {/* Shade around the crop box */}
            {[
              { left: 0, top: 0, width: '100%', height: dy },
              { left: 0, top: dy + dh, width: '100%', height: '100%' },
              { left: 0, top: dy, width: dx, height: dh },
              { left: dx + dw, top: dy, width: '100%', height: dh },
            ].map((s, i) => (
              <div
                key={i}
                className="pointer-events-none absolute bg-black/50"
                style={{ left: s.left, top: s.top, width: s.width, height: s.height }}
              />
            ))}
            {/* Crop box */}
            <div
              onPointerDown={(e) => onPointerDown(e, 'move')}
              className="absolute cursor-move border-2 border-white"
              style={{ left: dx, top: dy, width: dw, height: dh }}
            >
              {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
                <span
                  key={corner}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    onPointerDown(e, 'resize', corner);
                  }}
                  className={cn(
                    'absolute h-4 w-4 rounded-full border-2 border-white bg-primary',
                    corner.includes('n') ? 'top-0 -translate-y-1/2' : 'bottom-0 translate-y-1/2',
                    corner.includes('w') ? 'left-0 -translate-x-1/2' : 'right-0 translate-x-1/2',
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {processing && <ProcessingIndicator />}
      {error && <ErrorDisplay error={error} />}
      <ResultPanel results={results} originalSize={ctx.files[0]?.size} onReset={ctx.reset} />
    </div>
  );
}
