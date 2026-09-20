'use client';

import * as React from 'react';
import { Clock, Star } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { getTool } from '@/lib/tools/registry';
import { clearRecent, getFavorites, getRecent } from '@/lib/tools/history';
import { ToolCard } from './tool-card';

/**
 * "Recent" + "Favorites" homepage sections. Client-only and empty-aware:
 * first-time visitors see nothing (no layout shift, no empty states), while
 * returnees get one-click resumes of their own tools.
 */
export function PersonalSections() {
  const t = useTranslations();
  const [recent, setRecent] = React.useState<string[] | null>(null);
  const [favorites, setFavorites] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    const refresh = () => {
      setRecent(getRecent());
      setFavorites(getFavorites());
    };
    refresh();
    window.addEventListener('piclizer:history', refresh);
    return () => window.removeEventListener('piclizer:history', refresh);
  }, []);

  if (recent === null || favorites === null) return null;

  const visibleRecent = recent.filter((slug) => getTool(slug)).slice(0, 4);
  const visibleFavorites = favorites.filter((slug) => getTool(slug)).slice(0, 8);
  if (visibleRecent.length === 0 && visibleFavorites.length === 0) return null;

  const card = (slug: string) => {
    const tool = getTool(slug)!;
    return (
      <ToolCard
        key={slug}
        slug={tool.slug}
        name={t(tool.nameKey as never)}
        description={t(tool.shortKey as never)}
        icon={tool.icon}
        categoryLabel={t(`categoryMeta.${tool.category}.name` as never)}
        isNew={tool.isNew}
        newLabel={t('common.new')}
        ctaLabel={t('common.useTool')}
        favoriteSlug={tool.slug}
      />
    );
  };

  return (
    <>
      {visibleRecent.length > 0 && (
        <section className="container py-12" aria-labelledby="recent-tools-heading">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="recent-tools-heading" className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
                <Clock className="h-6 w-6 text-primary" aria-hidden="true" />
                {t('home.recentTitle')}
              </h2>
              <p className="mt-2 text-muted-foreground">{t('home.recentSubtitle')}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                clearRecent();
                setRecent([]);
              }}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {t('home.clearRecent')}
            </button>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visibleRecent.map(card)}</div>
        </section>
      )}
      {visibleFavorites.length > 0 && (
        <section className="container py-12" aria-labelledby="favorite-tools-heading">
          <h2 id="favorite-tools-heading" className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
            <Star className="h-6 w-6 text-primary" aria-hidden="true" />
            {t('home.favoritesTitle')}
          </h2>
          <p className="mt-2 text-muted-foreground">{t('home.favoritesSubtitle')}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{visibleFavorites.map(card)}</div>
        </section>
      )}
    </>
  );
}
