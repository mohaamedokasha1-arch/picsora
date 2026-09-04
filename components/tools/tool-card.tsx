'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { Link } from '@/lib/i18n/navigation';
import { ToolIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { isFavorite, toggleFavorite } from '@/lib/user-tools';

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
  const [favorite, setFavorite] = React.useState(false);

  React.useEffect(() => {
    setFavorite(isFavorite(slug));
    const onChange = () => setFavorite(isFavorite(slug));
    window.addEventListener('piclizer:favorites_changed', onChange);
    return () => window.removeEventListener('piclizer:favorites_changed', onChange);
  }, [slug]);

  const onFavClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = toggleFavorite(slug);
    setFavorite(next);
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-within:ring-2 focus-within:ring-ring',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <ToolIcon name={icon} className="h-5 w-5" />
          </span>
          {categoryLabel && <Badge variant="secondary">{categoryLabel}</Badge>}
          {isNew && (
            <Badge className="bg-primary text-primary-foreground">{newLabel ?? 'New'}</Badge>
          )}
        </div>

        <button
          type="button"
          onClick={onFavClick}
          aria-label={favorite ? 'Remove from favorites' : 'Add to favorites'}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md p-1.5 transition-colors hover:bg-secondary',
            favorite ? 'text-amber-500' : 'text-muted-foreground/40 hover:text-muted-foreground',
          )}
        >
          <Star className={cn('h-4 w-4', favorite && 'fill-amber-500')} />
        </button>
      </div>

      <Link href={target} className="flex-1 flex flex-col focus:outline-none">
        <h3 className="text-base font-semibold text-foreground">{name}</h3>
        <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
          {ctaLabel ?? name}
          <span aria-hidden="true" className="ms-1 transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5">
            →
          </span>
        </span>
      </Link>
    </div>
  );
}
