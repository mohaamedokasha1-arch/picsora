'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Camera, MapPin, Calendar, Sliders, Image as ImageIcon, Copy, Check, Download, ExternalLink } from 'lucide-react';
import { parseExifMetadata, type ExifData } from '@/lib/image/exif';
import { FileUploader, type UploadError } from '@/components/tools/file-uploader';
import { ErrorDisplay } from '@/components/tools/error-display';
import { defaultRuleFor } from '@/lib/validation';
import { ToolPanel, CopyButton, PrivacyNotice, StatGrid } from '@/components/tools/kit';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
import { triggerDownload } from '@/lib/image/format';

export default function PhotoMetadataViewer() {
  const t = useTranslations();
  const [file, setFile] = React.useState<File | null>(null);
  const [meta, setMeta] = React.useState<ExifData | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<UploadError | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [imgDim, setImgDim] = React.useState<{ w: number; h: number } | null>(null);

  const rule = React.useMemo(() => defaultRuleFor(['jpg', 'jpeg', 'heic', 'heif', 'png', 'webp', 'tiff', 'tif'], 1, 50), []);

  const handleFiles = async (files: File[]) => {
    if (!files.length) {
      setFile(null);
      setMeta(null);
      setPreviewUrl(null);
      setImgDim(null);
      return;
    }
    const selected = files[0];
    setFile(selected);
    setLoading(true);
    setError(null);

    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);

    try {
      const data = await parseExifMetadata(selected);
      setMeta(data);

      const img = new Image();
      img.onload = () => {
        setImgDim({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.src = url;
    } catch {
      setError({ key: 'corruptImage' });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setMeta(null);
    setPreviewUrl(null);
    setImgDim(null);
    setError(null);
  };

  const downloadJson = () => {
    if (!meta || !file) return;
    const exportData = {
      filename: file.name,
      fileSize: file.size,
      fileType: file.type,
      dimensions: imgDim ? `${imgDim.w}x${imgDim.h}` : undefined,
      exif: meta,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    triggerDownload(blob, `${file.name.replace(/\.[^/.]+$/, '')}-metadata.json`);
  };

  const width = meta?.width || imgDim?.w;
  const height = meta?.height || imgDim?.h;
  const mp = width && height ? ((width * height) / 1000000).toFixed(1) + ' MP' : undefined;

  return (
    <div className="space-y-6">
      {error && <ErrorDisplay error={error} onRetry={reset} />}

      {!file && (
        <FileUploader
          rule={rule}
          files={file ? [file] : []}
          onFilesChange={handleFiles}
          onError={setError}
          disabled={loading}
        />
      )}

      {file && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Camera className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-foreground">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)} · {file.type || 'image'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={downloadJson}>
                <Download className="me-1.5 h-3.5 w-3.5" />
                Export JSON
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                {t('common.uploadDifferent')}
              </Button>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-12">
            {/* Image Preview */}
            <div className="md:col-span-4">
              <ToolPanel title={t('controls.preview') || 'Photo'}>
                <div className="aspect-square w-full overflow-hidden rounded-lg border border-border bg-secondary/30">
                  {previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-full w-full object-contain"
                    />
                  )}
                </div>

                {width && height && (
                  <div className="mt-3 text-center text-xs text-muted-foreground">
                    {width} × {height} px {mp && `(${mp})`}
                  </div>
                )}
              </ToolPanel>
            </div>

            {/* Metadata Tables */}
            <div className="space-y-4 md:col-span-8">
              {/* Camera & Lens */}
              <ToolPanel title="Camera & Hardware">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Camera Make</span>
                    <span className="font-semibold text-sm text-foreground">{meta?.make || '—'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Camera Model</span>
                    <span className="font-semibold text-sm text-foreground">{meta?.model || '—'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Lens</span>
                    <span className="font-semibold text-sm text-foreground truncate block" title={meta?.lensModel}>{meta?.lensModel || '—'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Software</span>
                    <span className="font-semibold text-sm text-foreground truncate block">{meta?.software || '—'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Color Space</span>
                    <span className="font-semibold text-sm text-foreground">{meta?.colorSpace || 'sRGB'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Orientation Tag</span>
                    <span className="font-semibold text-sm text-foreground">{meta?.orientation ? `Orientation ${meta.orientation}` : '1 (Normal)'}</span>
                  </div>
                </div>
              </ToolPanel>

              {/* Exposure Settings */}
              <ToolPanel title="Exposure & Capture Settings">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Shutter Speed</span>
                    <span className="font-bold text-base text-primary">{meta?.exposureTime || '—'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Aperture</span>
                    <span className="font-bold text-base text-primary">{meta?.fNumber ? `f/${meta.fNumber}` : '—'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">ISO</span>
                    <span className="font-bold text-base text-primary">{meta?.iso || '—'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Focal Length</span>
                    <span className="font-bold text-base text-primary">{meta?.focalLength ? `${meta.focalLength} mm` : '—'}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Flash</span>
                    <span className="font-semibold text-sm text-foreground">{meta?.flash || '—'}</span>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/30 p-3">
                    <span className="text-xs text-muted-foreground block">Date Taken</span>
                    <span className="font-semibold text-sm text-foreground">{meta?.dateTimeOriginal || meta?.dateTime || '—'}</span>
                  </div>
                </div>
              </ToolPanel>

              {/* GPS / Location */}
              {meta?.gps && (
                <ToolPanel title="GPS Location">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3.5">
                      <div className="flex items-center gap-2.5">
                        <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <div>
                          <p className="font-semibold text-foreground text-sm">{meta.gps.formatted}</p>
                          {meta.gps.altitude !== undefined && (
                            <p className="text-xs text-muted-foreground">Altitude: {meta.gps.altitude} m</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <CopyButton value={`${meta.gps.latitude}, ${meta.gps.longitude}`} label="Copy Coords" />
                        <a
                          href={meta.gps.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground hover:bg-accent"
                        >
                          Google Maps <ExternalLink className="ms-1 h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </ToolPanel>
              )}

              <PrivacyNotice />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
