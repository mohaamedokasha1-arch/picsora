import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, disabled, id, className }: SwitchProps) {
  const inputId = id || React.useId();
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        id={inputId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rtl:-scale-x-100',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform',
            checked ? 'translate-x-5 rtl:-translate-x-5' : 'translate-x-0',
          )}
        />
      </button>
      {label && (
        <label htmlFor={inputId} className="cursor-pointer text-sm text-foreground">
          {label}
        </label>
      )}
    </div>
  );
}
