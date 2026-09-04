'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Pipette, Copy, Check, Sparkles, RefreshCw } from 'lucide-react';
import { ToolPanel, CopyButton, PrivacyNotice } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { rgbToHsl, rgbToHsv, rgbToCmyk, parseColor } from '@/lib/developer-tools/color';
import { rgbToHex } from '@/lib/image/process';

export default function ColorPickerTool() {
  const t = useTranslations();
  const [hex, setHex] = React.useState('#4F46E5');
  const [r, setR] = React.useState(79);
  const [g, setG] = React.useState(70);
  const [b, setB] = React.useState(229);

  // Sync RGB -> HEX
  const updateFromRgb = (newR: number, newG: number, newB: number) => {
    setR(newR);
    setG(newG);
    setB(newB);
    setHex(rgbToHex(newR, newG, newB));
  };

  // Sync HEX -> RGB
  const updateFromHex = (newHex: string) => {
    setHex(newHex);
    const parsed = parseColor(newHex);
    if (parsed) {
      setR(parsed.r);
      setG(parsed.g);
      setB(parsed.b);
    }
  };

  const hsl = rgbToHsl(r, g, b);
  const hsv = rgbToHsv(r, g, b);
  const cmyk = rgbToCmyk(r, g, b);

  const hexFormatted = hex.toUpperCase();
  const rgbFormatted = `rgb(${r}, ${g}, ${b})`;
  const rgbaFormatted = `rgba(${r}, ${g}, ${b}, 1.0)`;
  const hslFormatted = `hsl(${Math.round(hsl.h)}, ${Math.round(hsl.s)}%, ${Math.round(hsl.l)}%)`;
  const cmykFormatted = `cmyk(${Math.round(cmyk.c)}%, ${Math.round(cmyk.m)}%, ${Math.round(cmyk.y)}%, ${Math.round(cmyk.k)}%)`;

  // WCAG contrast calculation
  const getLuminance = (r8: number, g8: number, b8: number) => {
    const a = [r8, g8, b8].map((v) => {
      const vNorm = v / 255;
      return vNorm <= 0.03928 ? vNorm / 12.92 : Math.pow((vNorm + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };

  const lum = getLuminance(r, g, b);
  const contrastWhite = Number(((1.05) / (lum + 0.05)).toFixed(2));
  const contrastBlack = Number(((lum + 0.05) / 0.05).toFixed(2));

  // Eyedropper API
  const canEyeDrop = typeof window !== 'undefined' && 'EyeDropper' in window;
  const pickColorFromScreen = async () => {
    if (!canEyeDrop) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eyeDropper = new (window as any).EyeDropper();
      const res = await eyeDropper.open();
      if (res?.sRGBHex) updateFromHex(res.sRGBHex);
    } catch {
      /* cancelled */
    }
  };

  const randomColor = () => {
    const randR = Math.floor(Math.random() * 256);
    const randG = Math.floor(Math.random() * 256);
    const randB = Math.floor(Math.random() * 256);
    updateFromRgb(randR, randG, randB);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-12">
        {/* Visual Picker & Preview */}
        <div className="space-y-4 md:col-span-5">
          <ToolPanel title="Color Preview">
            <div
              className="h-44 w-full rounded-xl border border-border shadow-inner transition-colors duration-150 flex items-center justify-center"
              style={{ backgroundColor: hex }}
            >
              <div className="rounded-lg bg-black/40 backdrop-blur-md px-4 py-2 text-center text-white font-mono text-sm font-bold tracking-wide">
                {hexFormatted}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <input
                type="color"
                value={hex}
                onChange={(e) => updateFromHex(e.target.value)}
                className="h-10 flex-1 cursor-pointer rounded-lg border border-border bg-transparent p-1"
              />

              {canEyeDrop && (
                <Button type="button" variant="outline" onClick={pickColorFromScreen}>
                  <Pipette className="me-1.5 h-4 w-4 text-primary" />
                  Eyedropper
                </Button>
              )}

              <Button type="button" variant="outline" onClick={randomColor}>
                <RefreshCw className="me-1.5 h-4 w-4" />
                Random
              </Button>
            </div>
          </ToolPanel>

          {/* WCAG Contrast */}
          <ToolPanel title="WCAG Contrast & Readability">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-black p-3 text-white">
                <span className="text-xs opacity-75 block">On Black</span>
                <span className="text-lg font-bold">{contrastBlack}:1</span>
                <span className="text-[11px] block mt-0.5 opacity-90">
                  {contrastBlack >= 7 ? 'AAA (Pass)' : contrastBlack >= 4.5 ? 'AA (Pass)' : 'Fail'}
                </span>
              </div>
              <div className="rounded-lg border border-border bg-white p-3 text-black">
                <span className="text-xs opacity-75 block">On White</span>
                <span className="text-lg font-bold">{contrastWhite}:1</span>
                <span className="text-[11px] block mt-0.5 opacity-90">
                  {contrastWhite >= 7 ? 'AAA (Pass)' : contrastWhite >= 4.5 ? 'AA (Pass)' : 'Fail'}
                </span>
              </div>
            </div>
          </ToolPanel>
        </div>

        {/* Sliders & Color Values */}
        <div className="space-y-4 md:col-span-7">
          <ToolPanel title="RGB Channel Sliders">
            <div className="space-y-4">
              <div>
                <Slider
                  label="Red (R)"
                  min={0}
                  max={255}
                  value={r}
                  onValueChange={(val) => updateFromRgb(val, g, b)}
                />
              </div>

              <div>
                <Slider
                  label="Green (G)"
                  min={0}
                  max={255}
                  value={g}
                  onValueChange={(val) => updateFromRgb(r, val, b)}
                />
              </div>

              <div>
                <Slider
                  label="Blue (B)"
                  min={0}
                  max={255}
                  value={b}
                  onValueChange={(val) => updateFromRgb(r, g, val)}
                />
              </div>
            </div>
          </ToolPanel>

          {/* Formats Table */}
          <ToolPanel title="Color Formats & Values">
            <div className="space-y-2.5">
              {[
                { label: 'HEX', value: hexFormatted },
                { label: 'RGB', value: rgbFormatted },
                { label: 'RGBA', value: rgbaFormatted },
                { label: 'HSL', value: hslFormatted },
                { label: 'CMYK', value: cmykFormatted },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-lg border border-border bg-secondary/30 p-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-12 text-xs font-semibold text-muted-foreground">{item.label}</span>
                    <span className="font-mono text-sm font-bold text-foreground">{item.value}</span>
                  </div>
                  <CopyButton value={item.value} size="sm" />
                </div>
              ))}
            </div>
          </ToolPanel>

          <PrivacyNotice />
        </div>
      </div>
    </div>
  );
}
