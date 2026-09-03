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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('categories')}>
        <button
          type="button"
          role="tab"
          aria-selected={active === 'all'}
          onClick={() => setActive('all')}
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
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
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
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
        {filtered.map((tool) => (
          <ToolCard
            key={tool.slug}
            slug={tool.slug}
            name={tool.name}
            description={tool.description}
            icon={tool.icon}
            categoryLabel={tool.categoryLabel}
          />
        ))}
      </div>
    </div>
  );
}
