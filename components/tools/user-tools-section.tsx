'use client';

import * as React from 'react';
import { Star, History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFavorites, useRecentTools } from '@/lib/user-tools';
import { getTool, type ToolDef } from '@/lib/tools/registry';
import { ToolCard } from './tool-card';

export function UserToolsSection() {
  const t = useTranslations();
  const [favorites] = useFavorites();
  const recentSlugs = useRecentTools();

  const favoriteTools = React.useMemo(() => {
    return favorites
      .map((slug) => getTool(slug))
      .filter((t): t is ToolDef => Boolean(t));
  }, [favorites]);

  const recentTools = React.useMemo(() => {
    return recentSlugs
      .map((slug) => getTool(slug))
      .filter((t): t is ToolDef => Boolean(t))
      .slice(0, 4);
  }, [recentSlugs]);

  if (favoriteTools.length === 0 && recentTools.length === 0) {
    return null;
  }

  return (
    <div className="container space-y-12 py-8">
      {favoriteTools.length > 0 && (
        <section>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-amber-500 text-amber-500" />
            <h2 className="text-2xl font-bold text-foreground">
              {t('home.favoritesTitle') || 'Your Favorites'}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('home.favoritesSubtitle') || 'Quick access to your starred tools'}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {favoriteTools.map((tool) => (
              <ToolCard
                key={tool.slug}
                slug={tool.slug}
                name={t(tool.nameKey as never)}
                description={t(tool.shortKey as never)}
                icon={tool.icon}
                categoryLabel={t(`categoryMeta.${tool.category}.name` as never)}
              />
            ))}
          </div>
        </section>
      )}

      {recentTools.length > 0 && (
        <section>
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold text-foreground">
              {t('home.recentTitle') || 'Recently Used'}
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('home.recentSubtitle') || 'Tools you recently worked with'}
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recentTools.map((tool) => (
              <ToolCard
                key={tool.slug}
                slug={tool.slug}
                name={t(tool.nameKey as never)}
                description={t(tool.shortKey as never)}
                icon={tool.icon}
                categoryLabel={t(`categoryMeta.${tool.category}.name` as never)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
