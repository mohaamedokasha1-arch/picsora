'use client';

import * as React from 'react';
import { Check, Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/lib/utils';
import { triggerDownload } from '@/lib/image/format';

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

  const onClick = () => {
    triggerDownload(blob, filename);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2500);
  };

  return (
    <Button onClick={onClick} size={size} className={cn('max-w-full', className)}>
      <Download className="h-4 w-4" aria-hidden="true" />
      <span className="flex min-w-0 max-w-full flex-col items-start leading-tight">
        <span>{label ?? t('download')}</span>
        {/* Long document names are truncated instead of pushing the button
            (and the card around it) past the edge of a phone screen. */}
        <span className="max-w-full truncate text-[10px] font-normal opacity-80" title={filename}>
          {filename} · {formatBytes(blob.size)}
        </span>
      </span>
      {downloaded && <Check className="h-4 w-4" aria-hidden="true" />}
    </Button>
  );
}
