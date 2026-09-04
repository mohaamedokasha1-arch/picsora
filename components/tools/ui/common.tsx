'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export function ControlsCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5', className)}>
      {children}
    </div>
  );
}

export function useObjectUrl(source: Blob | File | null): string | null {
  const [url, setUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!source) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(source);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [source]);
  return url;
}

export function PreviewBox({
  src,
  label,
  className,
}: {
  src: string | null;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-secondary/40', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label ?? 'preview'} className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full min-h-[160px] w-full items-center justify-center text-sm text-muted-foreground">
          {label ?? 'preview'}
        </div>
      )}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
