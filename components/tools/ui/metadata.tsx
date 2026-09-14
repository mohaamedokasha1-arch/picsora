'use client';

import * as React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { WorkspaceContext } from '@/components/tools/tool-workspace';
import { PreviewBox, useObjectUrl } from './common';
import { CopyButton, Notice, ResetButton, StatGrid, TextDownloadButton, ToolPanel } from '@/components/tools/kit';
import { readImageMetadata, metadataToJson, type ImageMetadataReport } from '@/lib/image/metadata';
import { formatBytes } from '@/lib/utils';

/**
 * Values for tags whose raw EXIF number means something: the reader returns a
 * token such as 'rotated90' or 'centerWeighted', and this maps it to a
 * translated label. Anything not listed here is already human readable.
 */
const VALUE_KEYS: Record<string, Record<string, string>> = {
  orientation: {
    normal: 'v_normal',
    mirrored: 'v_mirrored',
    rotated180: 'v_rotated180',
    mirroredVertical: 'v_mirroredVertical',
    mirroredRotated90: 'v_mirroredRotated90',
    rotated90: 'v_rotated90',
    mirroredRotated270: 'v_mirroredRotated270',
    rotated270: 'v_rotated270',
  },
  flash: { noFlash: 'v_noFlash', flashFired: 'v_flashFired', flashNotFired: 'v_flashNotFired' },
  exposureProgram: {
    notDefined: 'v_notDefined',
    manual: 'v_manual',
    program: 'v_program',
    aperturePriority: 'v_aperturePriority',
    shutterPriority: 'v_shutterPriority',
    creative: 'v_creative',
    action: 'v_action',
    portrait: 'v_portrait',
    landscape: 'v_landscape',
  },
  meteringMode: {
    unknown: 'v_unknown',
    average: 'v_average',
    centerWeighted: 'v_centerWeighted',
    spot: 'v_spot',
    multiSpot: 'v_multiSpot',
    pattern: 'v_pattern',
    partial: 'v_partial',
  },
  resolutionUnit: { 'dpi (cm)': 'v_dpiCm', dpi: 'v_dpi', none: 'v_none' },
  colorSpace: { sRGB: 'v_srgb', Uncalibrated: 'v_uncalibrated' },
  exposureMode: { auto: 'v_auto', manual: 'v_manual', bracket: 'v_bracket' },
  whiteBalance: { auto: 'v_auto', manual: 'v_manual' },
};

export default function ImageMetadataTool({ ctx }: { ctx: WorkspaceContext }) {
  const t = useTranslations();
  const file = ctx.files[0];
  const decoded = ctx.decoded[0];
  const preview = useObjectUrl(file);
  const [report, setReport] = React.useState<ImageMetadataReport | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const next = await readImageMetadata(file, { width: decoded.width, height: decoded.height });
        if (!cancelled) setReport(next);
      } catch {
        if (!cancelled) {
          setReport(null);
          setError(t('errors.generic'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, decoded.width, decoded.height]);

  const exifRows = report?.exif ?? [];
  const extraRows = report?.extra ?? [];
  const hasExif = exifRows.length > 0;
  const json = report ? metadataToJson(report) : '';
  const copyText = [
    report ? `${t('common.siteName')} — ${report.fileName}` : '',
    ...exifRows.map((row) => `${row.key}: ${row.value}`),
    ...(report?.gps ? [`gps: ${report.gps.label}`] : []),
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <StatGrid
            columns={4}
            items={[
              { label: t('imageMeta.dimensions'), value: `${report?.width ?? decoded.width} × ${report?.height ?? decoded.height}`, accent: true },
              { label: t('imageMeta.megapixels'), value: `${report?.megapixels ?? 0} MP` },
              { label: t('imageMeta.aspectRatio'), value: report?.aspectRatio || '—' },
              { label: t('imageMeta.fileSize'), value: formatBytes(file.size) },
            ]}
          />

          <ToolPanel
            title={t('imageMeta.fileInfo')}
            actions={
              <>
                <CopyButton value={copyText} label={t('imageMeta.copyReport')} />
                <TextDownloadButton
                  value={json}
                  filename={`${file.name.replace(/\.[^.]+$/, '')}-metadata.json`}
                  mime="application/json"
                  label={t('imageMeta.downloadJson')}
                />
                <ResetButton onClick={ctx.reset} label={t('common.uploadDifferent')} />
              </>
            }
          >
            <dl className="divide-y divide-border text-sm">
              {[
                { label: t('imageMeta.fileName'), value: report?.fileName ?? file.name },
                { label: t('imageMeta.fileType'), value: report?.fileType ?? '—' },
                { label: t('imageMeta.fileSize'), value: formatBytes(file.size) },
                {
                  label: t('imageMeta.lastModified'),
                  value: new Date(report?.lastModified ?? file.lastModified).toLocaleString(),
                },
                { label: t('imageMeta.dimensions'), value: `${report?.width ?? 0} × ${report?.height ?? 0} px` },
              ].map((row) => (
                <div key={row.label} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="min-w-0 break-all text-end font-medium text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </ToolPanel>

          {report?.gps && (
            <Notice variant="warning">
              <span className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  {t('imageMeta.gpsWarning')}{' '}
                  <span className="font-semibold" dir="ltr">
                    {report.gps.label}
                  </span>
                  {report.gps.altitude !== undefined && <> · {report.gps.altitude} m</>}
                </span>
              </span>
            </Notice>
          )}

          <ToolPanel title={t('imageMeta.exifInfo')}>
            {loading ? (
              <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
            ) : hasExif ? (
              <dl className="divide-y divide-border text-sm">
                {exifRows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
                    <dt className="text-muted-foreground">{t(`imageMeta.f.${row.key}` as never)}</dt>
                    <dd className="min-w-0 break-words text-end font-medium text-foreground" dir="auto">
                      {(VALUE_KEYS[row.key]?.[row.value] &&
                        t(`imageMeta.${VALUE_KEYS[row.key][row.value]}` as never)) ||
                        row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">{t('imageMeta.noExif')}</p>
            )}
          </ToolPanel>

          {extraRows.length > 0 && (
            <ToolPanel title={t('imageMeta.otherTags')}>
              <dl className="divide-y divide-border text-sm">
                {extraRows.map((row) => (
                  <div key={row.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                    <dt className="font-mono text-xs text-muted-foreground">{row.key}</dt>
                    <dd className="min-w-0 break-words text-end text-foreground" dir="auto">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </ToolPanel>
          )}

          <Notice>{t('imageMeta.hint')}</Notice>
          {error && <Notice variant="warning">{error}</Notice>}
        </div>

        <PreviewBox src={preview} label={file.name} className="h-fit max-h-[420px]" />
      </div>
    </div>
  );
}
