'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { PenLine, Download, RotateCcw, Trash2, Check, Sparkles } from 'lucide-react';
import { ToolPanel, ControlsCard, Field, PrivacyNotice } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { triggerDownload } from '@/lib/image/format';

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export default function SignatureMaker() {
  const t = useTranslations();
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDrawing = React.useRef(false);
  const [strokes, setStrokes] = React.useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = React.useState<Point[]>([]);

  const [inkColor, setInkColor] = React.useState('#000000');
  const [penWidth, setPenWidth] = React.useState(3);
  const [transparentBg, setTransparentBg] = React.useState(true);

  // Redraw canvas
  const redraw = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!transparentBg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Baseline guide
    ctx.save();
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(40, canvas.height * 0.7);
    ctx.lineTo(canvas.width - 40, canvas.height * 0.7);
    ctx.stroke();
    ctx.restore();

    const allStrokes = currentStroke.length > 0
      ? [...strokes, { points: currentStroke, color: inkColor, width: penWidth }]
      : strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }

      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    }
  }, [strokes, currentStroke, inkColor, penWidth, transparentBg]);

  React.useEffect(() => {
    redraw();
  }, [redraw]);

  // Handle pointer / touch coordinates
  const getCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const pt = getCoords(e);
    if (!pt) return;
    isDrawing.current = true;
    setCurrentStroke([pt]);
  };

  const moveDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const pt = getCoords(e);
    if (!pt) return;
    setCurrentStroke((prev) => [...prev, pt]);
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentStroke.length > 0) {
      setStrokes((prev) => [...prev, { points: currentStroke, color: inkColor, width: penWidth }]);
      setCurrentStroke([]);
    }
  };

  const undo = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const clear = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  const downloadSignature = (format: 'png' | 'jpg') => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;

    // Create trimmed canvas
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    if (format === 'jpg' || !transparentBg) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    }

    // Draw strokes
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

      for (let i = 1; i < stroke.points.length - 1; i++) {
        const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
        const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
        ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
      }

      const last = stroke.points[stroke.points.length - 1];
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
      ctx.restore();
    }

    exportCanvas.toBlob(
      (blob) => {
        if (blob) triggerDownload(blob, `my-signature.${format}`);
      },
      format === 'png' ? 'image/png' : 'image/jpeg',
      0.95,
    );
  };

  const hasContent = strokes.length > 0 || currentStroke.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-12">
        {/* Controls Column */}
        <div className="space-y-4 md:col-span-5">
          <ControlsCard>
            <div className="space-y-4">
              <Field label="Ink Color">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'Black', color: '#000000' },
                    { label: 'Navy Blue', color: '#1e3a8a' },
                    { label: 'Royal Blue', color: '#2563eb' },
                    { label: 'Dark Red', color: '#991b1b' },
                  ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => setInkColor(c.color)}
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                        inkColor === c.color
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/40 text-foreground hover:bg-accent'
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Pen Thickness">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Fine (2px)', width: 2 },
                    { label: 'Medium (3px)', width: 3 },
                    { label: 'Thick (5px)', width: 5 },
                  ].map((w) => (
                    <button
                      key={w.label}
                      type="button"
                      onClick={() => setPenWidth(w.width)}
                      className={`rounded-md border p-2 text-xs font-medium text-center ${
                        penWidth === w.width
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary/40 text-foreground hover:bg-accent'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Background">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transparentBg}
                    onChange={(e) => setTransparentBg(e.target.checked)}
                    className="rounded border-input text-primary"
                  />
                  Transparent Background (PNG)
                </label>
              </Field>

              <div className="flex items-center gap-2 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={undo}
                  disabled={strokes.length === 0}
                  className="flex-1"
                >
                  <RotateCcw className="me-1.5 h-3.5 w-3.5" />
                  Undo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clear}
                  disabled={!hasContent}
                  className="flex-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="me-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            </div>
          </ControlsCard>

          <PrivacyNotice text="Your digital signature is rendered strictly in memory on your device and is never uploaded." />
        </div>

        {/* Drawing Pad Column */}
        <div className="md:col-span-7">
          <ToolPanel title="Draw Your Signature Here">
            <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-primary/40 bg-white dark:bg-zinc-950 p-2 touch-none shadow-sm">
              <canvas
                ref={canvasRef}
                width={800}
                height={360}
                onMouseDown={startDraw}
                onMouseMove={moveDraw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={moveDraw}
                onTouchEnd={endDraw}
                className="h-[240px] w-full cursor-crosshair rounded-lg touch-none"
              />
              {!hasContent && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-muted-foreground/50">
                  <span className="text-sm font-medium">Sign here using your mouse or finger</span>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <Button
                onClick={() => downloadSignature('png')}
                disabled={!hasContent}
                size="lg"
                className="w-full"
              >
                <Download className="me-2 h-4 w-4" />
                Download Transparent PNG
              </Button>
              <Button
                onClick={() => downloadSignature('jpg')}
                disabled={!hasContent}
                variant="outline"
                size="lg"
                className="w-full"
              >
                <Download className="me-2 h-4 w-4" />
                Download JPG (White BG)
              </Button>
            </div>
          </ToolPanel>
        </div>
      </div>
    </div>
  );
}
