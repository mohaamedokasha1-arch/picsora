'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import QRCode from 'qrcode';
import { QrCode as QrIcon, Download, Copy, Check, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ToolPanel, CopyButton, PrivacyNotice } from '@/components/tools/kit';
import { triggerDownload } from '@/lib/image/format';

export default function QrCodeGenerator() {
  const t = useTranslations();
  const [text, setText] = React.useState('https://piclizer.vercel.app');
  const [errorCorrection, setErrorCorrection] = React.useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [size, setSize] = React.useState<number>(512);
  const [darkColor, setDarkColor] = React.useState('#000000');
  const [lightColor, setLightColor] = React.useState('#ffffff');
  const [margin, setMargin] = React.useState(2);

  const [dataUrl, setDataUrl] = React.useState<string>('');
  const [svgString, setSvgString] = React.useState<string>('');
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!text.trim()) {
      setDataUrl('');
      setSvgString('');
      return;
    }

    let isCancelled = false;

    // Generate PNG Data URL
    QRCode.toDataURL(text, {
      errorCorrectionLevel: errorCorrection,
      width: size,
      margin,
      color: {
        dark: darkColor,
        light: lightColor,
      },
    })
      .then((url) => {
        if (!isCancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!isCancelled) setDataUrl('');
      });

    // Generate SVG string
    QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: errorCorrection,
      width: size,
      margin,
      color: {
        dark: darkColor,
        light: lightColor,
      },
    })
      .then((svg) => {
        if (!isCancelled) setSvgString(svg);
      })
      .catch(() => {
        if (!isCancelled) setSvgString('');
      });

    return () => {
      isCancelled = true;
    };
  }, [text, errorCorrection, size, darkColor, lightColor, margin]);

  const downloadPng = () => {
    if (!dataUrl) return;
    const byteString = atob(dataUrl.split(',')[1]);
    const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeString });
    triggerDownload(blob, 'qrcode.png');
  };

  const downloadSvg = () => {
    if (!svgString) return;
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(blob, 'qrcode.svg');
  };

  const copyImage = async () => {
    if (!dataUrl) return;
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-12">
        {/* Controls Column */}
        <div className="space-y-4 md:col-span-7">
          <ToolPanel title={t('controls.qrContent') || 'Content & Text'}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="qr-input" className="text-sm font-medium">
                  {t('controls.textOrUrl') || 'Text or URL'}
                </Label>
                <Input
                  id="qr-input"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="https://example.com or any text"
                  className="mt-1.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'URL', value: 'https://' },
                  { label: 'Wi-Fi', value: 'WIFI:S:MyNetwork;T:WPA;P:MyPassword;;' },
                  { label: 'Email', value: 'mailto:info@example.com?subject=Hello' },
                  { label: 'Phone', value: 'tel:+1234567890' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setText(preset.value)}
                    className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-foreground hover:bg-accent transition-colors text-center"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </ToolPanel>

          <ToolPanel title={t('controls.customization') || 'Customization'}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="qr-size" className="text-xs font-medium text-muted-foreground">
                  {t('controls.size') || 'Resolution'}
                </Label>
                <Select
                  id="qr-size"
                  value={String(size)}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="mt-1"
                >
                  <option value="256">256 × 256 px (Small)</option>
                  <option value="512">512 × 512 px (Standard)</option>
                  <option value="1024">1024 × 1024 px (High-Res)</option>
                  <option value="2048">2048 × 2048 px (Ultra HD)</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="qr-ecc" className="text-xs font-medium text-muted-foreground">
                  {t('controls.errorCorrection') || 'Error Correction'}
                </Label>
                <Select
                  id="qr-ecc"
                  value={errorCorrection}
                  onChange={(e) => setErrorCorrection(e.target.value as 'L' | 'M' | 'Q' | 'H')}
                  className="mt-1"
                >
                  <option value="L">Low (7%)</option>
                  <option value="M">Medium (15% - Recommended)</option>
                  <option value="Q">Quartile (25%)</option>
                  <option value="H">High (30% - Best for scanning)</option>
                </Select>
              </div>

              <div>
                <Label htmlFor="qr-dark" className="text-xs font-medium text-muted-foreground">
                  {t('controls.qrColor') || 'QR Color (Dark)'}
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="qr-dark"
                    type="color"
                    value={darkColor}
                    onChange={(e) => setDarkColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={darkColor}
                    onChange={(e) => setDarkColor(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="qr-light" className="text-xs font-medium text-muted-foreground">
                  {t('controls.bgColor') || 'Background Color (Light)'}
                </Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    id="qr-light"
                    type="color"
                    value={lightColor}
                    onChange={(e) => setLightColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={lightColor}
                    onChange={(e) => setLightColor(e.target.value)}
                    className="h-9 font-mono text-xs"
                  />
                </div>
              </div>
            </div>
          </ToolPanel>

          <PrivacyNotice />
        </div>

        {/* Preview Column */}
        <div className="md:col-span-5">
          <ToolPanel title={t('controls.preview') || 'Live Preview'} className="flex flex-col items-center">
            <div className="flex aspect-square w-full max-w-[280px] items-center justify-center rounded-xl border border-border bg-secondary/30 p-4">
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={dataUrl}
                  alt="Generated QR Code"
                  className="h-full w-full rounded-lg object-contain shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-muted-foreground">
                  <QrIcon className="h-12 w-12 stroke-[1.5]" />
                  <span className="mt-2 text-xs">Enter text to generate QR code</span>
                </div>
              )}
            </div>

            <div className="mt-6 flex w-full flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  onClick={downloadPng}
                  disabled={!dataUrl}
                  className="w-full"
                >
                  <Download className="me-1.5 h-4 w-4" />
                  Download PNG
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadSvg}
                  disabled={!svgString}
                  className="w-full"
                >
                  <Download className="me-1.5 h-4 w-4" />
                  Download SVG
                </Button>
              </div>

              <Button
                type="button"
                variant="secondary"
                onClick={copyImage}
                disabled={!dataUrl}
                className="w-full"
              >
                {copied ? <Check className="me-1.5 h-4 w-4 text-emerald-600" /> : <Copy className="me-1.5 h-4 w-4" />}
                {copied ? 'Copied to Clipboard!' : 'Copy Image'}
              </Button>
            </div>
          </ToolPanel>
        </div>
      </div>
    </div>
  );
}
