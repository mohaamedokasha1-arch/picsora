'use client';

import * as React from 'react';
import { Download } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/utils';
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
    <Button onClick={onClick} size={size} className={className}>
      <Download className="h-4 w-4" />
      <span className="flex flex-col items-start leading-tight">
        <span>{label ?? t('download')}</span>
        <span className="text-[10px] font-normal opacity-80">
          {filename} · {formatBytes(blob.size)}
        </span>
      </span>
      {downloaded && <span className="text-xs">✓</span>}
    </Button>
  );
}
