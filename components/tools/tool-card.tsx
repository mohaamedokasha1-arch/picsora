import { Link } from '@/lib/i18n/navigation';
import { ToolIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ToolCardProps {
  slug: string;
  name: string;
  description: string;
  icon: string;
  categoryLabel?: string;
  href?: string;
  ctaLabel?: string;
  isNew?: boolean;
  newLabel?: string;
  className?: string;
}

export function ToolCard({
  slug,
  name,
  description,
  icon,
  categoryLabel,
  href,
  ctaLabel,
  isNew,
  newLabel,
  className,
}: ToolCardProps) {
  const target = href ?? `/tools/${slug}`;
  return (
    <Link
      href={target}
      className={cn(
        'group relative flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <ToolIcon name={icon} className="h-5 w-5" />
        </span>
        {categoryLabel && <Badge variant="secondary">{categoryLabel}</Badge>}
        {isNew && (
          <Badge className="bg-primary text-primary-foreground">{newLabel ?? 'New'}</Badge>
        )}
      </div>
      <h3 className="text-base font-semibold text-foreground">{name}</h3>
      <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
        {ctaLabel ?? name}
        <span aria-hidden="true" className="ms-1 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  );
}
