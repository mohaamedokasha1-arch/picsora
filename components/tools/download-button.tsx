'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/lib/utils';
import { triggerDownload } from '@/lib/image/format';
import { validateOutput, type OutputValidationCode } from '@/lib/output-validation';
import { ErrorDisplay } from './error-display';

function formatFromFilename(filename: string, blob: Blob): string | undefined {
  const match = filename.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (match?.[1]) return match[1] === 'jpeg' ? 'jpg' : match[1];
  const mime = blob.type.toLowerCase();
  if (mime.includes('pdf')) return 'pdf';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg')) return 'jpg';
  if (mime.includes('zip')) return 'zip';
  return undefined;
}

interface DownloadButtonProps {
  blob: Blob;
  filename: string;
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  className?: string;
}

export function DownloadButton({ blob, filename, label, size = 'default', className }: DownloadButtonProps) {
  const t = useTranslations('common');
  const [downloaded, setDownloaded] = React.useState(false);
  const [checking, setChecking] = React.useState(true);
  const [validationError, setValidationError] = React.useState<OutputValidationCode | null>(null);

  const check = React.useCallback(async () => {
    setChecking(true);
    const result = await validateOutput(blob, { format: formatFromFilename(filename, blob) });
    setValidationError(result.valid ? null : (result.code ?? 'outputInvalid'));
    setChecking(false);
    return result.valid;
  }, [blob, filename]);

  React.useEffect(() => {
    void check();
  }, [check]);

  const onClick = async () => {
    if (!(await check())) return;
    await triggerDownload(blob, filename);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2600);
  };

  return (
    <>
      {validationError && <ErrorDisplay error={{ key: validationError }} />}
      <Button
      onClick={() => void onClick()}
      size={size}
      disabled={checking || !!validationError}
      success={downloaded}
      className={cn('max-w-full', className)}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      <span className="flex min-w-0 max-w-full flex-col items-start leading-tight">
        <span>{label ?? t('download')}</span>
        {/* Long document names are truncated instead of pushing the button
            (and the card around it) past the edge of a phone screen. */}
        <span className="max-w-full truncate text-[10px] font-normal opacity-80" title={filename}>
          {filename} · {formatBytes(blob.size)}
        </span>
      </span>
      </Button>
    </>
  );
}
