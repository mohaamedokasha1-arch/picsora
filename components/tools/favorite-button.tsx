'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { isFavorite, toggleFavorite } from '@/lib/tools/history';
import { cn } from '@/lib/utils';

/**
 * Star toggle that lives on tool cards. Cards are links, so the click is
 * stopped before it can navigate. Renders only after mount (localStorage is
 * client-only) to avoid hydration mismatches.
 */
export function FavoriteButton({ slug, className }: { slug: string; className?: string }) {
  const t = useTranslations();
  const [mounted, setMounted] = React.useState(false);
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setActive(isFavorite(slug));
    const onChange = () => setActive(isFavorite(slug));
    window.addEventListener('piclizer:history', onChange);
    return () => window.removeEventListener('piclizer:history', onChange);
  }, [slug]);

  if (!mounted) return null;

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? t('common.removeFavorite') : t('common.addFavorite')}
      title={active ? t('common.removeFavorite') : t('common.addFavorite')}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActive(toggleFavorite(slug));
      }}
      className={cn(
        'rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'text-amber-500 hover:text-amber-600',
        className,
      )}
    >
      <Star className={cn('h-4 w-4', active && 'fill-current')} aria-hidden="true" />
    </button>
  );
}
