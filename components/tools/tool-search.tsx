'use client';

import * as React from 'react';
import { Search } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/lib/i18n/navigation';
import { TOOLS } from '@/lib/tools/registry';
import { ToolIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

interface SearchItem {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  haystack: string;
}

function useSearchIndex(): SearchItem[] {
  const t = useTranslations();
  return React.useMemo(
    () =>
      TOOLS.map((tool) => {
        const name = t(tool.nameKey as never);
        const description = t(tool.shortKey as never);
        const category = t(tool.category === 'pdf' ? 'categoryMeta.pdf.name' : `categoryMeta.${tool.category}.name` as never);
        const haystack = [name, description, tool.keywords.join(' '), category]
          .join(' ')
          .toLowerCase();
        return { slug: tool.slug, name, description, icon: tool.icon, category, haystack };
      }),
    [t],
  );
}

export function ToolSearch({
  placeholder,
  onNavigate,
  className,
  autoFocus,
}: {
  placeholder?: string;
  onNavigate?: () => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const t = useTranslations('common');
  const router = useRouter();
  const index = useSearchIndex();
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return index
      .filter((item) => item.haystack.includes(q))
      .slice(0, 8);
  }, [query, index]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (slug: string) => {
    router.push(`/tools/${slug}`);
    setOpen(false);
    setQuery('');
    onNavigate?.();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      const item = results[active];
      if (item) go(item.slug);
    }
  };

  return (
    <div ref={boxRef} className={cn('relative w-full', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-label={t('search')}
          value={query}
          autoFocus={autoFocus}
          placeholder={placeholder ?? t('searchTools')}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {open && query.trim() && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t('searchNoResults')}</p>
          ) : (
            <ul role="listbox" className="max-h-80 overflow-auto py-1">
              {results.map((item, i) => (
                <li key={item.slug} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(item.slug)}
                    className={cn(
                      'flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors',
                      i === active && 'bg-accent',
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <ToolIcon name={item.icon} className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                      {item.category}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function HeaderSearch({ onNavigate }: { onNavigate?: () => void }) {
  return <ToolSearch onNavigate={onNavigate} className="w-64" />;
}
