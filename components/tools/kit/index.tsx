'use client';

/**
 * Shared UI primitives for the PDF / text / calculator / developer tools.
 * These reuse the existing design tokens so the new pages are visually
 * indistinguishable from the original image tools.
 */

import * as React from 'react';
import { Check, Copy, RotateCcw, Download, AlertTriangle, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { triggerDownload } from '@/lib/image/format';

export { ControlsCard, Field } from '@/components/tools/ui/common';

/* ------------------------------------------------------------------ panel */

export function ToolPanel({
  children,
  className,
  title,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-xl border border-border bg-card p-4 sm:p-5', className)}>
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------- copy */

export function CopyButton({
  value,
  label,
  size = 'sm',
  variant = 'outline',
  className,
}: {
  value: string;
  label?: string;
  size?: 'default' | 'sm' | 'icon-sm';
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  className?: string;
}) {
  const t = useTranslations('common');
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Clipboard API can be blocked; fall back to a temporary textarea.
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand('copy');
      } catch {
        /* nothing else we can do */
      }
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={copy}
      disabled={!value}
      className={className}
      aria-label={label ?? t('copy')}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {size !== 'icon-sm' && <span>{copied ? t('copied') : (label ?? t('copy'))}</span>}
    </Button>
  );
}

/* --------------------------------------------------------------- download */

export function TextDownloadButton({
  value,
  filename,
  mime = 'text/plain;charset=utf-8',
  label,
  size = 'sm',
}: {
  value: string;
  filename: string;
  mime?: string;
  label?: string;
  size?: 'default' | 'sm';
}) {
  const t = useTranslations('common');
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={!value}
      onClick={() => triggerDownload(new Blob([value], { type: mime }), filename)}
    >
      <Download className="h-3.5 w-3.5" />
      {label ?? t('download')}
    </Button>
  );
}

export function ResetButton({ onClick, label }: { onClick: () => void; label?: string }) {
  const t = useTranslations('common');
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      <RotateCcw className="h-3.5 w-3.5" />
      {label ?? t('reset')}
    </Button>
  );
}

/* ------------------------------------------------------------------ stats */

export interface StatItem {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}

export function StatGrid({ items, columns = 4 }: { items: StatItem[]; columns?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        'grid gap-3',
        columns === 2 && 'grid-cols-2',
        columns === 3 && 'grid-cols-2 sm:grid-cols-3',
        columns === 4 && 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
      )}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-lg border border-border bg-secondary/30 p-3',
            item.accent && 'border-primary/40 bg-primary/5',
          )}
        >
          <div className="text-xs font-medium text-muted-foreground">{item.label}</div>
          <div className="mt-1 break-words text-lg font-bold tabular-nums text-foreground">{item.value}</div>
          {item.hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{item.hint}</div>}
        </div>
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- notice */

export function Notice({
  children,
  variant = 'info',
}: {
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'privacy';
}) {
  const Icon = variant === 'warning' ? AlertTriangle : Info;
  return (
    <div
      role="note"
      className={cn(
        'flex gap-2.5 rounded-lg border p-3 text-sm leading-relaxed',
        variant === 'warning'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
          : variant === 'privacy'
            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
            : 'border-border bg-secondary/40 text-muted-foreground',
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/** Every new tool shows the same local-processing reassurance. */
export function PrivacyNotice({ text }: { text?: string }) {
  const t = useTranslations('common');
  return <Notice variant="privacy">{text ?? t('allProcessingLocal')}</Notice>;
}

/* ------------------------------------------------------------------ error */

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{message}</span>
    </div>
  );
}

/* --------------------------------------------------------------- progress */

export function ProgressBar({ value, max, label }: { value: number; max: number; label?: string }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      {label && <div className="text-xs font-medium text-muted-foreground">{label}</div>}
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary transition-all duration-200" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- controls */

export function ToggleGroup<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; hint?: string }[];
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            title={option.hint}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              value === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CheckboxRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 text-sm hover:bg-accent/40">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-[hsl(var(--primary))]"
      />
      <span className="min-w-0">
        <span className="text-foreground">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------- text area */

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { mono?: boolean }>(
  ({ className, mono, ...props }, ref) => (
    <textarea
      ref={ref}
      spellCheck={false}
      className={cn(
        'w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60',
        mono && 'font-mono text-[13px] leading-relaxed',
        className,
      )}
      {...props}
    />
  ),
);
TextArea.displayName = 'TextArea';

/** Textarea with a gutter of line numbers, used by the developer tools. */
export function CodeArea({
  value,
  onChange,
  placeholder,
  readOnly,
  minHeight = 260,
  ariaLabel,
  onKeyDown,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight?: number;
  ariaLabel: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLTextAreaElement>;
}) {
  const gutterRef = React.useRef<HTMLDivElement>(null);
  const lines = React.useMemo(() => value.split('\n').length, [value]);

  return (
    <div className="flex overflow-hidden rounded-lg border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring">
      <div
        ref={gutterRef}
        aria-hidden="true"
        className="select-none overflow-hidden border-e border-border bg-secondary/40 px-2 py-3 text-end font-mono text-[13px] leading-relaxed text-muted-foreground"
        style={{ minWidth: 44 }}
      >
        {Array.from({ length: Math.max(lines, 1) }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        dir="ltr"
        aria-label={ariaLabel}
        spellCheck={false}
        readOnly={readOnly}
        value={value}
        placeholder={placeholder}
        onKeyDown={onKeyDown}
        onChange={(e) => onChange?.(e.target.value)}
        onScroll={(e) => {
          if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
        }}
        className="w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
        style={{ minHeight }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------- helpers */

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/** Read a plain-text file the user picks, for the text tools' upload buttons. */
export function useTextFileInput(onLoad: (text: string) => void) {
  const ref = React.useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="text/*,.txt,.text,.md,.markdown,.csv,.json,.xml,.log,.yml,.yaml"
      className="sr-only"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        onLoad(await file.text());
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}
