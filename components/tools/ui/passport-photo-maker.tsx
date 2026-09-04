'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { UserCheck, Download, ZoomIn, ZoomOut, RotateCw, RefreshCw, Grid } from 'lucide-react';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { ToolPanel, ControlsCard, Field, PrivacyNotice } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { triggerDownload } from '@/lib/image/format';

interface Preset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
}

const PRESETS: Preset[] = [
  { id: 'us', name: 'US / India / Passport (2 × 2 in / 51 × 51 mm)', widthMm: 51, heightMm: 51, widthPx: 600, heightPx: 600 },
  { id: 'uk_eu', name: 'UK / EU / Schengen / Australia (35 × 45 mm)', widthMm: 35, heightMm: 45, widthPx: 413, heightPx: 531 },
  { id: 'canada', name: 'Canada Passport (50 × 70 mm)', widthMm: 50, heightMm: 70, widthPx: 590, heightPx: 826 },
  { id: 'id_3040', name: 'ID Card / Badge (30 × 40 mm)', widthMm: 30, heightMm: 40, widthPx: 354, heightPx: 472 },
];

export function PassportPhotoMakerUI({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const [selectedPreset, setSelectedPreset] = React.useState<string>('us');
  const [zoom, setZoom] = React.useState<number>(100); // 50..250
  const [offsetX, setOffsetX] = React.useState<number>(0);
  const [offsetY, setOffsetY] = React.useState<number>(0);
  const [bgColor, setBgColor] = React.useState<string>('#ffffff');
  const [showGuide, setShowGuide] = React.useState(true);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const decoded = ctx.decoded[0];

  const currentPreset = PRESETS.find((p) => p.id === selectedPreset) || PRESETS[0];

  // Render canvas
  React.useEffect(() => {
    if (!decoded || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const w = currentPreset.widthPx;
    const h = currentPreset.heightPx;

    canvas.width = w;
    canvas.height = h;

    // Background fill
    ctx2d.fillStyle = bgColor;
    ctx2d.fillRect(0, 0, w, h);

    // Draw photo scaled and centered
    const scale = (zoom / 100) * Math.max(w / decoded.width, h / decoded.height);
    const drawW = decoded.width * scale;
    const drawH = decoded.height * scale;
    const drawX = (w - drawW) / 2 + offsetX;
    const drawY = (h - drawH) / 2 + offsetY;

    if (decoded.bitmap) {
      ctx2d.drawImage(decoded.bitmap, drawX, drawY, drawW, drawH);
    } else {
      ctx2d.drawImage(decoded.image, drawX, drawY, drawW, drawH);
    }

    // Guide overlay
    if (showGuide) {
      ctx2d.save();
      ctx2d.strokeStyle = 'rgba(79, 70, 229, 0.7)';
      ctx2d.lineWidth = 2;
      ctx2d.setLineDash([6, 6]);

      // Oval for head
      const headCx = w / 2;
      const headCy = h * 0.45;
      const headRx = w * 0.28;
      const headRy = h * 0.32;

      ctx2d.beginPath();
      ctx2d.ellipse(headCx, headCy, headRx, headRy, 0, 0, 2 * Math.PI);
      ctx2d.stroke();

      // Eye line
      ctx2d.beginPath();
      ctx2d.moveTo(w * 0.15, h * 0.42);
      ctx2d.lineTo(w * 0.85, h * 0.42);
      ctx2d.stroke();

      // Chin line
      ctx2d.beginPath();
      ctx2d.moveTo(w * 0.25, h * 0.77);
      ctx2d.lineTo(w * 0.75, h * 0.77);
      ctx2d.stroke();

      ctx2d.restore();
    }
  }, [decoded, currentPreset, zoom, offsetX, offsetY, bgColor, showGuide]);

  const downloadSingle = () => {
    if (!decoded) return;
    const canvas = document.createElement('canvas');
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;

    const w = currentPreset.widthPx;
    const h = currentPreset.heightPx;
    canvas.width = w;
    canvas.height = h;

    ctx2d.fillStyle = bgColor;
    ctx2d.fillRect(0, 0, w, h);

    const scale = (zoom / 100) * Math.max(w / decoded.width, h / decoded.height);
    const drawW = decoded.width * scale;
    const drawH = decoded.height * scale;
    const drawX = (w - drawW) / 2 + offsetX;
    const drawY = (h - drawH) / 2 + offsetY;

    if (decoded.bitmap) {
      ctx2d.drawImage(decoded.bitmap, drawX, drawY, drawW, drawH);
    } else {
      ctx2d.drawImage(decoded.image, drawX, drawY, drawW, drawH);
    }

    canvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `passport-photo-${currentPreset.id}.jpg`);
    }, 'image/jpeg', 0.95);
  };

  const downloadPrintableSheet = () => {
    if (!decoded) return;
    // Standard 4x6 inch (1200x1800 px at 300 DPI) photo print sheet
    const sheetCanvas = document.createElement('canvas');
    sheetCanvas.width = 1800; // 6 inch
    sheetCanvas.height = 1200; // 4 inch
    const sCtx = sheetCanvas.getContext('2d');
    if (!sCtx) return;

    sCtx.fillStyle = '#ffffff';
    sCtx.fillRect(0, 0, 1800, 1200);

    // Single cropped canvas
    const single = document.createElement('canvas');
    single.width = currentPreset.widthPx;
    single.height = currentPreset.heightPx;
    const s2d = single.getContext('2d');
    if (!s2d) return;

    s2d.fillStyle = bgColor;
    s2d.fillRect(0, 0, single.width, single.height);

    const scale = (zoom / 100) * Math.max(single.width / decoded.width, single.height / decoded.height);
    const drawW = decoded.width * scale;
    const drawH = decoded.height * scale;
    const drawX = (single.width - drawW) / 2 + offsetX;
    const drawY = (single.height - drawH) / 2 + offsetY;

    if (decoded.bitmap) {
      s2d.drawImage(decoded.bitmap, drawX, drawY, drawW, drawH);
    } else {
      s2d.drawImage(decoded.image, drawX, drawY, drawW, drawH);
    }

    // Place grid on 4x6 sheet
    const cols = currentPreset.id === 'us' ? 2 : 3;
    const rows = 2;
    const gapX = (1800 - cols * single.width) / (cols + 1);
    const gapY = (1200 - rows * single.height) / (rows + 1);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const posX = gapX + c * (single.width + gapX);
        const posY = gapY + r * (single.height + gapY);

        sCtx.drawImage(single, posX, posY);

        // Thin cutting border
        sCtx.strokeStyle = '#cccccc';
        sCtx.lineWidth = 1;
        sCtx.strokeRect(posX, posY, single.width, single.height);
      }
    }

    sheetCanvas.toBlob((blob) => {
      if (blob) triggerDownload(blob, `passport-print-sheet-4x6.jpg`);
    }, 'image/jpeg', 0.95);
  };

  const resetAdjustments = () => {
    setZoom(100);
    setOffsetX(0);
    setOffsetY(0);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-12">
        {/* Controls Column */}
        <div className="space-y-4 md:col-span-6">
          <ControlsCard>
            <div className="space-y-4">
              <Field label="Passport / Visa Standard">
                <Select
                  value={selectedPreset}
                  onChange={(e) => setSelectedPreset(e.target.value)}
                >
                  {PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Zoom">
                <div className="flex items-center gap-2 pt-1">
                  <ZoomOut className="h-4 w-4 text-muted-foreground" />
                  <Slider
                    label="Zoom Level"
                    min={40}
                    max={200}
                    step={2}
                    valueSuffix="%"
                    value={zoom}
                    onValueChange={setZoom}
                  />
                  <ZoomIn className="h-4 w-4 text-muted-foreground" />
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Position X">
                  <Slider
                    label="X Offset"
                    min={-200}
                    max={200}
                    step={2}
                    valueSuffix="px"
                    value={offsetX}
                    onValueChange={setOffsetX}
                  />
                </Field>
                <Field label="Position Y">
                  <Slider
                    label="Y Offset"
                    min={-200}
                    max={200}
                    step={2}
                    valueSuffix="px"
                    value={offsetY}
                    onValueChange={setOffsetY}
                  />
                </Field>
              </div>

              <Field label="Background Color">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: 'White', color: '#ffffff' },
                    { label: 'Off-White', color: '#f8fafc' },
                    { label: 'Light Grey', color: '#e2e8f0' },
                    { label: 'Light Blue', color: '#e0f2fe' },
                  ].map((bg) => (
                    <button
                      key={bg.label}
                      type="button"
                      onClick={() => setBgColor(bg.color)}
                      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium ${
                        bgColor === bg.color
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-secondary/40 text-foreground'
                      }`}
                    >
                      <span className="h-3 w-3 rounded-full border border-border" style={{ backgroundColor: bg.color }} />
                      {bg.label}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="flex items-center justify-between border-t border-border pt-3">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGuide}
                    onChange={(e) => setShowGuide(e.target.checked)}
                    className="rounded border-input text-primary"
                  />
                  Show Biometric Head Guidelines
                </label>

                <Button type="button" variant="ghost" size="sm" onClick={resetAdjustments}>
                  <RefreshCw className="me-1 h-3 w-3" />
                  Reset
                </Button>
              </div>
            </div>
          </ControlsCard>

          <PrivacyNotice />
        </div>

        {/* Canvas Preview Column */}
        <div className="md:col-span-6">
          <ToolPanel title="Passport Photo Preview" className="flex flex-col items-center">
            <div className="flex max-h-[360px] w-full items-center justify-center overflow-hidden rounded-xl border border-border bg-secondary/30 p-4">
              <canvas
                ref={canvasRef}
                className="max-h-[320px] max-w-full rounded-md object-contain shadow-md"
              />
            </div>

            <div className="mt-6 flex w-full flex-col gap-2.5">
              <Button onClick={downloadSingle} size="lg" className="w-full">
                <Download className="me-2 h-4 w-4" />
                Download Single Photo ({currentPreset.widthPx} × {currentPreset.heightPx} px)
              </Button>

              <Button onClick={downloadPrintableSheet} variant="outline" size="lg" className="w-full">
                <Grid className="me-2 h-4 w-4" />
                Download 4×6&quot; Printable Sheet ({currentPreset.id === 'us' ? '4 photos' : '6 photos'})
              </Button>
            </div>
          </ToolPanel>
        </div>
      </div>
    </div>
  );
}
