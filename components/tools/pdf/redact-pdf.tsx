'use client';

import * as React from 'react';
import { EyeOff, AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ActionButton } from '@/components/ui/action-button';
import { DownloadButton } from '@/components/tools/download-button';
import { formatBytes } from '@/lib/utils';
import { PdfDropzone, useErrorText, useSinglePdf, usePageThumbnails, ThumbnailSkeleton } from './shared';
import { redactPdfPermanent, type RedactionRect } from '@/lib/pdf-processing/redact';
import { InlineError, Notice, PrivacyNotice, ToolPanel, ResetButton, StatGrid, ProgressBar } from '../kit';

const MAX_MB = 50;

export default function RedactPdfTool() {
  const t = useTranslations();
  const errorText = useErrorText();
  const { file, info, error: loadError, setError, loading, load, reset } = useSinglePdf();
  const [redactions, setRedactions] = React.useState<RedactionRect[]>([]);
  const [selectedPage, setSelectedPage] = React.useState(0);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });

  const { thumbs, rendering } = usePageThumbnails(file, !!file, 200);

  const combinedError = localError || loadError;

  const handleFiles = async (files: File[]) => {
    setResultBlob(null);
    setRedactions([]);
    setLocalError(null);
    await load(files);
  };

  const addRedaction = (pageIndex: number) => {
    // Add a default centered redaction rectangle
    // User can adjust via inputs; for simplicity, default 40% width, 15% height centered
    setRedactions((prev) => [
      ...prev,
      {
        pageIndex,
        x: 100,
        y: 300,
        width: 200,
        height: 30,
      },
    ]);
  };

  const redact = async () => {
    if (!file || !redactions.length) {
      setLocalError('Add at least one redaction area');
      return;
    }
    setBusy(true);
    setLocalError(null);
    setResultBlob(null);
    setProgress({ done: 0, total: info?.pageCount || 0 });
    try {
      const blob = await redactPdfPermanent(file, redactions, { permanent: true }, (done, total) => setProgress({ done, total }));
      setResultBlob(blob);
    } catch (e) {
      setLocalError(e instanceof Error ? e.message : errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = () => {
    reset();
    setRedactions([]);
    setResultBlob(null);
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
          <ToolPanel title={`Redact — ${info.pageCount} pages · ${formatBytes(info.size)}`} actions={<ResetButton onClick={handleReset} />}>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Permanent redaction:</strong> This tool rasterizes redacted pages to images and blacks out selected areas, ensuring original text under redaction CANNOT be recovered by selecting or editing PDF content. Trade-off: redacted pages become image-based (text not selectable). This is honest permanent removal, unlike fake overlay that just draws black boxes over still-selectable text. Redacted PDF is safe to share.
                </div>
              </div>
            </div>

            {thumbs.length === 0 && rendering ? <ThumbnailSkeleton count={4} /> : (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {thumbs.map((src, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPage(idx)}
                      className={`relative rounded-lg border-2 overflow-hidden ${selectedPage === idx ? 'border-primary' : 'border-border hover:border-primary/50'}`}
                    >
                      <img src={src} alt={`Page ${idx + 1}`} className="w-full aspect-[3/4] object-contain bg-white" />
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">Page {idx + 1}</span>
                      {redactions.some(r => r.pageIndex === idx) && (
                        <span className="absolute top-1 right-1 rounded bg-red-600 px-1.5 py-0.5 text-[10px] text-white">{redactions.filter(r => r.pageIndex === idx).length} redacted</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm font-medium">Selected page: {selectedPage + 1}</span>
                    <Button size="sm" onClick={() => addRedaction(selectedPage)}><EyeOff className="h-4 w-4 mr-1" /> Add redaction area</Button>
                    <span className="text-xs text-muted-foreground">Default area at (100,300) 200x30 — adjust below</span>
                  </div>

                  {redactions.length > 0 && (
                    <div className="space-y-2 max-h-[300px] overflow-auto">
                      {redactions.map((r, i) => (
                        <div key={i} className="grid grid-cols-6 gap-2 items-center rounded-lg border bg-secondary/30 px-2 py-2 text-xs">
                          <span>Page {r.pageIndex + 1}</span>
                          <label className="flex flex-col">X<input type="number" value={r.x} onChange={(e) => setRedactions(prev => prev.map((rect, idx) => idx === i ? { ...rect, x: parseInt(e.target.value) || 0 } : rect))} className="rounded border px-1 py-0.5 text-xs" /></label>
                          <label className="flex flex-col">Y<input type="number" value={r.y} onChange={(e) => setRedactions(prev => prev.map((rect, idx) => idx === i ? { ...rect, y: parseInt(e.target.value) || 0 } : rect))} className="rounded border px-1 py-0.5 text-xs" /></label>
                          <label className="flex flex-col">W<input type="number" value={r.width} onChange={(e) => setRedactions(prev => prev.map((rect, idx) => idx === i ? { ...rect, width: parseInt(e.target.value) || 10 } : rect))} className="rounded border px-1 py-0.5 text-xs" /></label>
                          <label className="flex flex-col">H<input type="number" value={r.height} onChange={(e) => setRedactions(prev => prev.map((rect, idx) => idx === i ? { ...rect, height: parseInt(e.target.value) || 10 } : rect))} className="rounded border px-1 py-0.5 text-xs" /></label>
                          <button onClick={() => setRedactions(prev => prev.filter((_, idx) => idx !== i))} className="text-red-600 hover:underline">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2">
                    <ActionButton onClick={redact} disabled={busy || !redactions.length} processing={busy} success={!!resultBlob}>
                      Redact permanently
                    </ActionButton>
                    {busy && <div className="mt-3"><ProgressBar value={progress.done} max={progress.total} label={`Redacting page ${progress.done} of ${progress.total}`} /></div>}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Coordinates: PDF points, origin bottom-left. X=0 left, Y=0 bottom. Page size typically ~595x842 points (A4). Use thumbnails to estimate placement. For precise visual placement, future version will add drag selection — currently manual coordinates. Honest permanent removal via rasterization.
                  </p>
                </div>
              </div>
            )}
          </ToolPanel>
        </>
      )}

      {resultBlob && (
        <ToolPanel title="Redacted PDF — Permanent, safe to share">
          <DownloadButton blob={resultBlob} filename={file ? file.name.replace(/\.pdf$/i, '-redacted.pdf') : 'redacted.pdf'} />
          <p className="mt-3 text-xs text-muted-foreground">
            Redacted pages were rasterized to JPEG images with black rectangles burned in, then re-embedded as PDF pages. Original text under redaction is gone — not just covered. Non-redacted pages remain selectable. This is real permanent redaction, not overlay. Processed locally via pdf.js rendering + pdf-lib.
          </p>
        </ToolPanel>
      )}

      {!file && (
        <>
          <Notice>
            PDF Redaction permanently removes content by rasterizing redacted pages to images and blacking out areas — ensuring text cannot be recovered via copy/paste or content stream editing. This is real removal, not just black overlay. Trade-off: redacted pages become image-based. Private, local, safe to share after redaction.
          </Notice>
          <PrivacyNotice />
          <div className="rounded-xl border bg-card p-5 text-sm">
            <h3 className="font-semibold">Limits & Honest UX</h3>
            <ul className="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
              <li>Input: PDF up to {MAX_MB} MB</li>
              <li>Output: Valid PDF, redacted pages as JPEG images (92% quality), non-redacted pages preserved as-is</li>
              <li>Permanent: original text under redaction removed via rasterization, not recoverable</li>
              <li>Trade-off: redacted pages text not selectable, slight quality loss (2x render scale for quality)</li>
              <li>Fake overlay redaction (just drawing black boxes over selectable text) is NOT secure — this tool avoids that</li>
              <li>Coordinates manual for now — visual drag selection planned. Use thumbnails to estimate.</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
