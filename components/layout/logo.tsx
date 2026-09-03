import { cn } from '@/lib/utils';

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg
        aria-hidden="true"
        viewBox="0 0 40 40"
        className="h-8 w-8 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="1.5" y="1.5" width="37" height="37" rx="10" fill="hsl(var(--primary))" />
        <circle cx="15.5" cy="14.5" r="6" fill="white" fillOpacity="0.95" />
        <path
          d="M9 30.5L18.5 19.5L25 26L33 17"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="33" cy="15.5" r="2.6" fill="white" />
      </svg>
      {withText && (
        <span className="text-xl font-bold tracking-tight text-foreground">
          Piclizer
        </span>
      )}
    </span>
  );
}
