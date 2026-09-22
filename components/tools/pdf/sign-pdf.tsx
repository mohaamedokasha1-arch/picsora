'use client';

import * as React from 'react';
import { PenTool, Type, Trash2, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/utils';
import { PdfDropzone, useErrorText, useSinglePdf, usePageThumbnails, ThumbnailSkeleton } from './shared';
import { signPdf, createTextSignatureImage, dataUrlToBytes } from '@/lib/pdf-processing/sign';
import { InlineError, Notice, PrivacyNotice, ToolPanel, ResetButton, StatGrid } from '../kit';

const MAX_MB = 50;

type SignMode = 'draw' | 'type';

interface Placement {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function SignPdfTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const { file, info, error: loadError, setError, loading, load, reset } = useSinglePdf();
  const [mode, setMode] = React.useState<SignMode>('draw');
  const [typedText, setTypedText] = React.useState('John Doe');
  const [signatureDataUrl, setSignatureDataUrl] = React.useState<string | null>(null);
  const [placements, setPlacements] = React.useState<Placement[]>([]);
  const [selectedPage, setSelectedPage] = React.useState(0);
  const [sigWidth, setSigWidth] = React.useState(150);
  const [sigHeight, setSigHeight] = React.useState(60);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDrawing = React.useRef(false);
  const lastPos = React.useRef<{ x: number; y: number } | null>(null);

  const { thumbs, rendering } = usePageThumbnails(file, !!file, 200);

  const combinedError = localError || loadError;

  const handleFiles = async (files: File[]) => {
    setResultBlob(null);
    setPlacements([]);
    setLocalError(null);
    setSignatureDataUrl(null);
    await load(files);
  };

  // Drawing logic
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getCanvasPos(e);
    lastPos.current = pos;
    const canvas = canvasRef.current;
    if (!canvas || !pos) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const pos = getCanvasPos(e);
    const canvas = canvasRef.current;
    if (!canvas || !pos || !lastPos.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSignatureDataUrl(canvas.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // White background for better visibility
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [mode]);

  const generateTyped = async () => {
    try {
      const bytes = await createTextSignatureImage(typedText, { fontSize: 48, width: 400, height: 120 });
      const blob = new Blob([bytes as any], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      // Convert blob to data URL for preview
      const reader = new FileReader();
      reader.onload = () => setSignatureDataUrl(reader.result as string);
      reader.readAsDataURL(blob);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : 'Failed to create typed signature');
    }
  };

  const addPlacement = () => {
    if (selectedPage < 0 || !info) return;
    // Place in bottom-right-ish default, user can adjust via inputs
    setPlacements((prev) => [
      ...prev,
      {
        pageIndex: selectedPage,
        x: 100,
        y: 100,
        width: sigWidth,
        height: sigHeight,
      },
    ]);
  };

  const sign = async () => {
    if (!file || !signatureDataUrl || !placements.length) {
      setLocalError('Create a signature and add at least one placement');
      return;
    }
    setBusy(true);
    setLocalError(null);
    setResultBlob(null);
    try {
      const sigBytes = await dataUrlToBytes(signatureDataUrl);
      const blob = await signPdf(file, sigBytes, placements.map(p => ({ ...p, opacity: 100 })));
      setResultBlob(blob);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    reset();
    setResultBlob(null);
    setPlacements([]);
    setSignatureDataUrl(null);
    setLocalError(null);
  };

  return (
    <div className="space-y-5">
      <InlineError message={combinedError} />

      {!file && (
        <PdfDropzone multiple={false} maxFiles={1} maxFileSizeMB={MAX_MB} onFiles={handleFiles} onError={setError} disabled={busy || loading} />
      )}

      {file && info && (
        <>
          <ToolPanel title={`Signature — ${mode === 'draw' ? 'Draw' : 'Typed'}`} actions={<ResetButton onClick={handleReset} />}>
            <div className="flex gap-2 mb-4">
              <Button variant={mode === 'draw' ? 'default' : 'outline'} size="sm" onClick={() => setMode('draw')}><PenTool className="h-4 w-4 mr-1" /> Draw</Button>
              <Button variant={mode === 'type' ? 'default' : 'outline'} size="sm" onClick={() => setMode('type')}><Type className="h-4 w-4 mr-1" /> Typed</Button>
              <Button variant="ghost" size="sm" onClick={clearCanvas}><Trash2 className="h-4 w-4 mr-1" /> Clear</Button>
            </div>

            {mode === 'draw' ? (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-white p-2">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full touch-none rounded-lg border border-dashed border-border bg-white"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Draw your signature with mouse or finger. Black ink on white background. Clear and redraw if needed.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    placeholder="Your name"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <Button size="sm" onClick={generateTyped}>Generate</Button>
                </div>
                <p className="text-xs text-muted-foreground">Typed signature uses cursive font. Generates a PNG stamp.</p>
              </div>
            )}

            {signatureDataUrl && (
              <div className="mt-4 rounded-lg border border-border bg-secondary/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Preview</p>
                <img src={signatureDataUrl} alt="Signature preview" className="max-h-20 bg-white rounded border" />
              </div>
            )}
          </ToolPanel>

          <ToolPanel title={`Place signature on PDF — ${info.pageCount} pages`}>
            {thumbs.length === 0 && rendering ? <ThumbnailSkeleton count={4} /> : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {thumbs.map((src, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPage(idx)}
                      className={`relative rounded-lg border-2 overflow-hidden ${selectedPage === idx ? 'border-primary' : 'border-border hover:border-primary/50'}`}
                    >
                      <img src={src} alt={`Page ${idx + 1}`} className="w-full aspect-[3/4] object-contain bg-white" />
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Page {idx + 1}</span>
                      {placements.some(p => p.pageIndex === idx) && (
                        <span className="absolute top-1 right-1 rounded bg-green-600 px-1.5 py-0.5 text-[10px] text-white">Signed</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3 items-end rounded-xl border bg-card p-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Page</label>
                    <input type="number" min={0} max={info.pageCount - 1} value={selectedPage} onChange={(e) => setSelectedPage(parseInt(e.target.value) || 0)} className="w-20 rounded border px-2 py-1 text-sm" />
                    <span className="text-[10px] text-muted-foreground">0-indexed, {info.pageCount} pages</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">X</label>
                    <input type="number" value={100} readOnly className="w-20 rounded border px-2 py-1 text-sm bg-muted" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Y</label>
                    <input type="number" value={100} readOnly className="w-20 rounded border px-2 py-1 text-sm bg-muted" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Width</label>
                    <input type="number" value={sigWidth} onChange={(e) => setSigWidth(parseInt(e.target.value) || 150)} className="w-20 rounded border px-2 py-1 text-sm" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Height</label>
                    <input type="number" value={sigHeight} onChange={(e) => setSigHeight(parseInt(e.target.value) || 60)} className="w-20 rounded border px-2 py-1 text-sm" />
                  </div>
                  <Button size="sm" onClick={addPlacement} disabled={!signatureDataUrl}>Add to page {selectedPage + 1}</Button>
                </div>

                {placements.length > 0 && (
                  <div className="rounded-xl border bg-card p-4">
                    <p className="text-sm font-medium mb-2">Placements ({placements.length})</p>
                    <ul className="space-y-1 text-xs">
                      {placements.map((p, i) => (
                        <li key={i} className="flex justify-between rounded bg-secondary/50 px-2 py-1">
                          <span>Page {p.pageIndex + 1} at ({p.x},{p.y}) {p.width}x{p.height}</span>
                          <button onClick={() => setPlacements(prev => prev.filter((_, idx) => idx !== i))} className="text-red-600 hover:underline">Remove</button>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      <ActionButton onClick={sign} disabled={busy || !signatureDataUrl || !placements.length} processing={busy} success={!!resultBlob}>Apply signature</ActionButton>
                    </div>
                  </div>
                )}
              </div>
            )}
          </ToolPanel>
        </>
      )}

      {resultBlob && (
        <ToolPanel title="Signed PDF — Visual only, not certified">
          <div className="flex gap-3 items-center">
            <DownloadButton blob={resultBlob} filename={file ? file.name.replace(/\.pdf$/i, '-signed.pdf') : 'signed.pdf'} />
            <span className="text-sm text-muted-foreground">Visual signature applied locally</span>
          </div>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <strong>Important:</strong> This is a visual signature stamp only — it paints your signature image onto PDF pages. It is NOT a certified digital signature (no cryptographic signing, no certificate). It does not provide legal non-repudiation. For legally binding signatures, use Adobe Acrobat with a digital certificate or a qualified e-signature service. This tool is for informal approval, drafts, and personal use.
          </div>
        </ToolPanel>
      )}

      {!file && (
        <>
          <Notice>Sign PDF adds a visual signature (drawn or typed) onto PDF pages locally in your browser. The signature is a PNG image stamped with pdf-lib. No upload, private.</Notice>
          <PrivacyNotice />
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h3 className="font-semibold">Limits & Honest UX</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Visual only: not a certified digital signature, no certificate, no PKI</li>
              <li>Draw mode: canvas drawing → PNG, typed mode: cursive font → PNG</li>
              <li>Placement: X/Y coordinates in PDF points (bottom-left origin), adjustable width/height</li>
              <li>Does NOT lock document or prevent further editing — use Protect PDF after signing if needed</li>
              <li>For legal validity, check jurisdiction requirements — this tool creates appearance only</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
