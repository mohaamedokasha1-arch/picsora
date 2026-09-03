import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onValueChange: (value: number) => void;
  label?: string;
  valueSuffix?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
}

/** Accessible range slider built on a native input for reliability. */
export function Slider({
  min,
  max,
  step = 1,
  value,
  onValueChange,
  label,
  valueSuffix = '',
  className,
  disabled,
  id,
}: SliderProps) {
  const inputId = id || React.useId();
  const percent = max === min ? 0 : ((value - min) / (max - min)) * 100;
  return (
    <div className={cn('w-full', className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-semibold tabular-nums text-secondary-foreground">
          {value}
          {valueSuffix}
        </span>
      </div>
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(Number(e.target.value))}
        className="slider-native w-full"
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) ${percent}%, hsl(var(--secondary)) ${percent}%)`,
        }}
      />
    </div>
  );
}
