'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { ControlsCard } from './common';
import { rgbToHex, rgbToHsl } from '@/lib/image/process';
import { copyText } from '@/lib/image/format';
import { cn } from '@/lib/utils';

interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

export default function ColorPickerTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const decoded = ctx.decoded[0];
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const magRef = React.useRef<HTMLCanvasElement>(null);
  const [scale, setScale] = React.useState(1);
  const [picked, setPicked] = React.useState<RGBA | null>(null);
  const [hover, setHover] = React.useState<RGBA | null>(null);
  const [history, setHistory] = React.useState<RGBA[]>([]);
  const [copied, setCopied] = React.useState<string | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !decoded) return;
    const s = Math.min(1, 3000 / Math.max(decoded.width, decoded.height));
    setScale(s);
    canvas.width = Math.round(decoded.width * s);
    canvas.height = Math.round(decoded.height * s);
    const cctx = canvas.getContext('2d');
    if (!cctx) return;
    if (decoded.bitmap) cctx.drawImage(decoded.bitmap, 0, 0, canvas.width, canvas.height);
    else cctx.drawImage(decoded.image, 0, 0, canvas.width, canvas.height);
  }, [decoded]);

  const sampleAt = (clientX: number, clientY: number): RGBA | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cctx = canvas.getContext('2d');
    if (!cctx) return null;
    const rect = canvas.getBoundingClientRect();
    const nx = Math.floor(((clientX - rect.left) / rect.width) * canvas.width);
    const ny = Math.floor(((clientY - rect.top) / rect.height) * canvas.height);
    if (nx < 0 || ny < 0 || nx >= canvas.width || ny >= canvas.height) return null;
    const d = cctx.getImageData(nx, ny, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  };

  const drawMagnifier = (color: RGBA, clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    const mag = magRef.current;
    if (!canvas || !mag) return;
    const mctx = mag.getContext('2d');
    if (!mctx) return;
    const rect = canvas.getBoundingClientRect();
    const nx = ((clientX - rect.left) / rect.width) * canvas.width;
    const ny = ((clientY - rect.top) / rect.height) * canvas.height;
    const size = 100;
    const zoom = 6;
    const sx = nx - size / 2 / zoom;
    const sy = ny - size / 2 / zoom;
    mag.width = size;
    mag.height = size;
    mctx.imageSmoothingEnabled = false;
    mctx.clearRect(0, 0, size, size);
    mctx.drawImage(canvas, sx, sy, size / zoom, size / zoom, 0, 0, size, size);
    // crosshair
    mctx.strokeStyle = 'rgba(0,0,0,0.7)';
    mctx.lineWidth = 1;
    mctx.beginPath();
    mctx.moveTo(size / 2, 0);
    mctx.lineTo(size / 2, size);
    mctx.moveTo(0, size / 2);
    mctx.lineTo(size, size / 2);
    mctx.stroke();
    mctx.strokeStyle = '#fff';
    mctx.beginPath();
    mctx.arc(size / 2, size / 2, 2, 0, Math.PI * 2);
    mctx.fillStyle = color.a > 125 ? '#000' : '#fff';
    mctx.fill();
  };

  const onMove = (e: React.MouseEvent) => {
    const c = sampleAt(e.clientX, e.clientY);
    if (c) {
      setHover(c);
      drawMagnifier(c, e.clientX, e.clientY);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    const c = sampleAt(e.clientX, e.clientY);
    if (c) {
      setPicked(c);
      setHistory((h) => {
        const dedupe = h.filter((x) => !(x.r === c.r && x.g === c.g && x.b === c.b));
        return [c, ...dedupe].slice(0, 10);
      });
    }
  };

  const active = picked ?? hover;

  const copy = async (value: string, kind: string) => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    }
  };

  const hex = active ? rgbToHex(active.r, active.g, active.b) : '#000000';
  const rgb = active ? `rgb(${active.r}, ${active.g}, ${active.b})` : 'rgb(0, 0, 0)';
  const hslObj = active ? rgbToHsl(active.r, active.g, active.b) : { h: 0, s: 0, l: 0 };
  const hsl = active ? `hsl(${hslObj.h}, ${hslObj.s}%, ${hslObj.l}%)` : 'hsl(0, 0%, 0%)';

  const valueRows = [
    { kind: 'HEX', value: hex },
    { kind: 'RGB', value: rgb },
    { kind: 'HSL', value: hsl },
  ];

  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <ControlsCard>
        <h3 className="text-sm font-semibold text-foreground">{t('controls.pickColor')}</h3>
        {active && (
          <>
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 shrink-0 rounded-lg border border-border shadow-inner" style={{ background: hex }} />
              <div className="flex-1 space-y-1">
                {valueRows.map((row) => (
                  <button
                    key={row.kind}
                    type="button"
                    onClick={() => copy(row.value, row.kind)}
                    className="flex w-full items-center justify-between rounded-md bg-secondary/60 px-3 py-1.5 text-sm transition-colors hover:bg-accent"
                    title={t('common.copy')}
                  >
                    <span className="text-xs font-semibold text-muted-foreground">{row.kind}</span>
                    <span className="font-mono text-xs text-foreground">{copied === row.kind ? '✓ ' + t('common.copied') : row.value}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {history.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">{t('controls.colorHistory')}</p>
            <div className="flex flex-wrap gap-2">
              {history.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPicked(c);
                    copy(rgbToHex(c.r, c.g, c.b), 'HEX');
                  }}
                  className="h-8 w-8 rounded-md border border-border shadow-sm transition-transform hover:scale-110"
                  style={{ background: rgbToHex(c.r, c.g, c.b) }}
                  title={`${rgbToHex(c.r, c.g, c.b)} — ${t('common.copy')}`}
                />
              ))}
            </div>
          </div>
        )}
      </ControlsCard>

      <div className="relative">
        <div className="overflow-hidden rounded-xl border border-border bg-secondary/40">
          <canvas
            ref={canvasRef}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            onClick={onClick}
            className="block h-auto w-full cursor-crosshair"
            aria-label={t('controls.pickColor')}
          />
        </div>
        <canvas
          ref={magRef}
          className={cn(
            'pointer-events-none absolute top-2 end-2 rounded-lg border-2 border-border shadow-lg transition-opacity',
            hover ? 'opacity-100' : 'opacity-0',
          )}
          width={100}
          height={100}
          aria-hidden="true"
        />
      </div>
    </div>
  );
}
