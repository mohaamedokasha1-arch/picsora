'use client';

/**
 * Live effect preview: draws the uploaded image into a canvas, runs the very
 * same pixel routine the processor uses, and — when the tool works on
 * selected areas — lets the user drag (or tap) rectangles straight onto the
 * image.
 *
 * The canvas is downscaled to a comfortable preview size; every effect takes a
 * resolution-independent parameter (see lib/image/effects) so what is drawn
 * here matches the exported file.
 */

import * as React from 'react';
import { MousePointerSquareDashed, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { DecodedImage } from '@/lib/types';
import { sourceOf } from '@/lib/image/process';
import type { NormRect } from '@/lib/image/effects';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';

export interface EffectPreviewProps {
  decoded: DecodedImage;
  /**
   * Pixel routine — identical maths to the matching processor. Use this for
   * every effect that only rewrites pixels (blur, pixelate, filters…).
   */
  effect?: (data: Uint8ClampedArray, width: number, height: number) => void;
  /**
   * Canvas routine for effects that change the drawing itself (rounded
   * corners clipping into transparency). Receives the downscaled canvas and
   * the already-loaded image source.
   */
  render?: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    source: CanvasImageSource,
  ) => void;
  /** Re-runs the effect when these change (sliders, regions, presets…). */
  deps: React.DependencyList;
  regions?: NormRect[];
  onRegionsChange?: (regions: NormRect[]) => void;
  /** Enables the drag-to-select overlay. */
  selectable?: boolean;
  className?: string;
  maxEdge?: number;
  alt?: string;
}

/** Tap-to-redact default box (percentage of the image) used on touch devices. */
const TAP_BOX = { w: 0.24, h: 0.18 };

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalize(a: { x: number; y: number }, b: { x: number; y: number }): NormRect {
  return {
    x: clamp01(Math.min(a.x, b.x)),
    y: clamp01(Math.min(a.y, b.y)),
    w: clamp01(Math.abs(a.x - b.x)),
    h: clamp01(Math.abs(a.y - b.y)),
  };
}

export function EffectPreview({
  decoded,
  effect,
  render,
  deps,
  regions = [],
  onRegionsChange,
  selectable = false,
  className,
  maxEdge = 1200,
  alt,
}: EffectPreviewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [draft, setDraft] = React.useState<NormRect | null>(null);
  const dragOrigin = React.useRef<{ x: number; y: number } | null>(null);
  const effectRef = React.useRef(effect);
  effectRef.current = effect;
  const renderRef = React.useRef(render);
  renderRef.current = render;

  // Deferred so a slider drag never blocks the pointer.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const width = Math.max(1, Math.round(decoded.width * scale));
    const height = Math.max(1, Math.round(decoded.height * scale));
    const paint = () => {
      if (cancelled) return;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const source = sourceOf(decoded) as CanvasImageSource;
      ctx.clearRect(0, 0, width, height);
      if (renderRef.current) {
        renderRef.current(ctx, width, height, source);
        return;
      }
      ctx.drawImage(source, 0, 0, width, height);
      if (!effectRef.current) return;
      const imageData = ctx.getImageData(0, 0, width, height);
      effectRef.current(imageData.data, width, height);
      ctx.putImageData(imageData, 0, 0);
    };
    const id = window.requestAnimationFrame(paint);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded, maxEdge, ...deps]);

  const pointToNorm = (clientX: number, clientY: number) => {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    return { x: (clientX - box.left) / box.width, y: (clientY - box.top) / box.height };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!selectable || !onRegionsChange) return;
    const start = pointToNorm(e.clientX, e.clientY);
    if (!start) return;
    dragOrigin.current = start;
    setDraft({ x: start.x, y: start.y, w: 0, h: 0 });

    const move = (ev: PointerEvent) => {
      const origin = dragOrigin.current;
      if (!origin) return;
      const current = pointToNorm(ev.clientX, ev.clientY);
      if (!current) return;
      setDraft(normalize(origin, current));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      const origin = dragOrigin.current;
      dragOrigin.current = null;
      setDraft(null);
      if (!origin) return;
      const end = pointToNorm(ev.clientX, ev.clientY) ?? origin;
      const rect = normalize(origin, end);
      // A tap (or a tiny drag) creates a comfortable default box centred on
      // the touch point — precise dragging on a phone is hard.
      if (rect.w * decoded.width < 12 || rect.h * decoded.height < 12) {
        const centred: NormRect = {
          x: clamp01(origin.x - TAP_BOX.w / 2),
          y: clamp01(origin.y - TAP_BOX.h / 2),
          w: TAP_BOX.w,
          h: TAP_BOX.h,
        };
        centred.w = Math.min(centred.w, 1 - centred.x);
        centred.h = Math.min(centred.h, 1 - centred.y);
        onRegionsChange([...regions, centred]);
        return;
      }
      onRegionsChange([...regions, rect]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div className={cn('space-y-3', className)}>
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-xl border border-border bg-[repeating-conic-gradient(hsl(var(--secondary))_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]"
      >
        <canvas
          ref={canvasRef}
          aria-label={alt}
          onPointerDown={onPointerDown}
          className={cn('mx-auto block h-auto w-full max-w-full', selectable && 'cursor-crosshair')}
          style={selectable ? { touchAction: 'none' } : undefined}
        />
        {[...regions, ...(draft ? [draft] : [])].map((rect, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute rounded-sm border-2',
              i < regions.length ? 'border-primary bg-primary/20' : 'border-primary/70 bg-primary/10',
            )}
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          />
        ))}
      </div>
      {selectable && <RegionHint />}
    </div>
  );
}

function RegionHint() {
  const t = useTranslations('controls');
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <MousePointerSquareDashed className="h-3.5 w-3.5" aria-hidden="true" />
      {t('regionHint')}
    </p>
  );
}

/** Numbered list of the selected areas with individual remove buttons. */
export function RegionList({
  regions,
  onRegionsChange,
  disabled,
}: {
  regions: NormRect[];
  onRegionsChange: (regions: NormRect[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('controls');
  if (!regions.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">
          {t('selectedAreas', { count: regions.length })}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => onRegionsChange([])}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {t('clearAreas')}
        </Button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {regions.map((rect, i) => (
          <li key={i}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onRegionsChange(regions.filter((_, idx) => idx !== i))}
              className="inline-flex min-h-[32px] items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-destructive/40 hover:text-foreground disabled:opacity-60"
            >
              <span className="font-semibold text-foreground">#{i + 1}</span>
              {t('removeArea')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
