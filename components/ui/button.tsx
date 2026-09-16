import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  link: 'text-primary underline-offset-4 hover:underline',
} as const;

const sizes = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3 text-xs sm:h-8',
  lg: 'h-12 rounded-lg px-6 text-base',
  icon: 'h-10 w-10',
  'icon-sm': 'h-9 w-9 sm:h-8 sm:w-8',
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  loading?: boolean;
  success?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading = false, success = false, children, disabled, ...props }, ref) => {
    const isDisabled = disabled || loading;
    const isPrimaryAction = variant === 'default' || variant === 'destructive';
    
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        data-variant={variant}
        data-success={success ? 'true' : undefined}
        data-loading={loading ? 'true' : undefined}
        className={cn(
          // Base layout
          'group/btn relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:pointer-events-none disabled:opacity-50',
          // Core transitions - smooth premium feel (cute + premium)
          'transition-all duration-200 ease-out',
          'will-change-transform select-none',
          // Micro-interaction: hover lift + scale + shadow (cute + premium)
          'hover:enabled:-translate-y-[1.5px] hover:enabled:scale-[1.015]',
          'active:enabled:translate-y-0 active:enabled:scale-[0.97]',
          'active:enabled:duration-100',
          // Shadow on hover for primary
          isPrimaryAction && 'hover:enabled:shadow-[0_8px_20px_-6px_hsl(var(--primary)/0.35),0_4px_8px_-4px_hsl(var(--primary)/0.2)]',
          !isPrimaryAction && variant !== 'link' && variant !== 'ghost' && 'hover:enabled:shadow-[0_6px_16px_-4px_hsl(var(--foreground)/0.08),0_2px_6px_-2px_hsl(var(--foreground)/0.06)]',
          // Link variant shouldn't have transform
          variant === 'link' && 'hover:enabled:translate-y-0 hover:enabled:scale-100',
          // Shine container
          'overflow-hidden',
          variants[variant],
          sizes[size],
          className,
        )}
        {...props}
      >
        {/* Subtle shine sweep - not the only indicator, just enhancement */}
        {variant !== 'link' && variant !== 'ghost' && (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-0 -translate-x-full skew-x-[-12deg]',
              'bg-gradient-to-r from-transparent via-white/15 to-transparent',
              'opacity-0 transition-all duration-700 ease-out',
              'group-hover/btn:translate-x-full group-hover/btn:opacity-100',
              'group-active/btn:transition-none group-active/btn:opacity-0',
            )}
          />
        )}
        
        {/* Loading spinner */}
        {loading && (
          <span
            aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        )}
        
        {/* Success check with cute pop animation */}
        {success && !loading && (
          <span className="btn-success-check inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white/20 ring-1 ring-white/20">
            <Check className="h-3.5 w-3.5" strokeWidth={3.2} aria-hidden="true" />
          </span>
        )}
        
        {/* Content wrapper with smooth transition for success state */}
        <span
          className={cn(
            'relative inline-flex items-center justify-center gap-2 transition-all duration-200 ease-out',
            success && !loading && 'btn-success-content',
          )}
        >
          {children}
        </span>
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button };
