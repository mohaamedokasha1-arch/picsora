'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ToolCard } from './tool-card';
import { cn } from '@/lib/utils';

export interface GridTool {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  categoryLabel: string;
  isNew?: boolean;
}

export function ToolsGrid({ tools }: { tools: GridTool[] }) {
  const t = useTranslations('common');
  const [active, setActive] = React.useState<string>('all');
  const categories = React.useMemo(() => {
    const map = new Map<string, string>();
    tools.forEach((tool) => map.set(tool.category, tool.categoryLabel));
    return Array.from(map.entries());
  }, [tools]);

  const filtered = active === 'all' ? tools : tools.filter((tool) => tool.category === active);
  // Group by category, then alphabetically: the "All" view reads in the same
  // order as the tabs instead of the order tools happened to be registered in.
  const ordered = React.useMemo(() => {
    const rank = new Map<string, number>();
    tools.forEach((tool) => {
      if (!rank.has(tool.category)) rank.set(tool.category, rank.size);
    });
    return [...filtered].sort(
      (a, b) =>
        (rank.get(a.category) ?? 0) - (rank.get(b.category) ?? 0) ||
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }),
    );
  }, [filtered, tools]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('categories')}>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'all'}
          onClick={() => setActive('all')}
          className={cn(
            'rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:py-1.5',
            active === 'all'
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          {t('allTools')} ({tools.length})
        </button>
        {categories.map(([slug, label]) => (
          <button
            key={slug}
            type="button"
            role="tab"
            aria-selected={active === slug}
            onClick={() => setActive(slug)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-medium transition-colors sm:py-1.5',
              active === slug
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ordered.map((tool) => (
          <ToolCard
            key={tool.slug}
            slug={tool.slug}
            name={tool.name}
            description={tool.description}
            icon={tool.icon}
            categoryLabel={tool.categoryLabel}
            isNew={tool.isNew}
            newLabel={t('new')}
            ctaLabel={t('useTool')}
          />
        ))}
      </div>
    </div>
  );
}
