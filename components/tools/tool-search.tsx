'use client';

import * as React from 'react';
import { Search, Sparkles, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/lib/i18n/navigation';
import { TOOLS, getPopularTools } from '@/lib/tools/registry';
import { ToolIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { trackSearch } from '@/lib/analytics';

interface SearchItem {
  slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  haystack: string;
  tokens: string[];
}

const SYNONYMS: Record<string, string[]> = {
  iphone: ['heic-to-jpg', 'heic-to-png', 'heif-to-jpg', 'heif-to-png', 'photo-metadata-viewer'],
  ios: ['heic-to-jpg', 'heic-to-png', 'heif-to-jpg', 'heif-to-png'],
  apple: ['heic-to-jpg', 'heic-to-png', 'heif-to-jpg', 'heif-to-png'],
  compress: ['image-compressor', 'exact-kb-image-compressor', 'pdf-compressor'],
  reduce: ['image-compressor', 'exact-kb-image-compressor', 'pdf-compressor'],
  shrink: ['image-compressor', 'exact-kb-image-compressor', 'pdf-compressor'],
  small: ['image-compressor', 'exact-kb-image-compressor'],
  '500kb': ['exact-kb-image-compressor', 'image-compressor'],
  '200kb': ['exact-kb-image-compressor', 'image-compressor'],
  '100kb': ['exact-kb-image-compressor', 'image-compressor'],
  kb: ['exact-kb-image-compressor', 'image-compressor'],
  convert: ['jpg-to-png', 'png-to-jpg', 'jpg-to-webp', 'png-to-webp', 'webp-to-jpg', 'webp-to-png', 'heic-to-jpg'],
  change: ['jpg-to-png', 'png-to-jpg', 'jpg-to-webp', 'heic-to-jpg'],
  transform: ['jpg-to-png', 'png-to-jpg', 'heic-to-jpg'],
  'remove background': ['png-to-jpg', 'jpg-to-png', 'signature-maker'],
  'no bg': ['signature-maker', 'png-to-jpg'],
  transparent: ['png-to-jpg', 'signature-maker', 'jpg-to-png'],
  'text from image': ['ocr-image-to-text', 'pdf-to-text'],
  'read image': ['ocr-image-to-text'],
  ocr: ['ocr-image-to-text', 'pdf-to-text'],
  rotate: ['image-rotator', 'flip-image-horizontal', 'flip-image-vertical', 'pdf-rotate-pages'],
  flip: ['flip-image-horizontal', 'flip-image-vertical', 'image-rotator'],
  turn: ['image-rotator', 'flip-image-horizontal', 'pdf-rotate-pages'],
  // Arabic synonyms
  'ضغط': ['image-compressor', 'exact-kb-image-compressor', 'pdf-compressor'],
  'تصغير': ['image-compressor', 'exact-kb-image-compressor', 'image-resizer'],
  'تحويل': ['jpg-to-png', 'png-to-jpg', 'heic-to-jpg', 'jpg-to-webp'],
  'ايفون': ['heic-to-jpg', 'heic-to-png', 'heif-to-jpg'],
  'أيفون': ['heic-to-jpg', 'heic-to-png'],
  'تدوير': ['image-rotator', 'flip-image-horizontal', 'pdf-rotate-pages'],
  'توقيع': ['signature-maker'],
  'جواز': ['passport-photo-maker'],
  'نص من صورة': ['ocr-image-to-text'],
  'باركود': ['qr-code-generator'],
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[a.length][b.length];
}

function matchesWithTypoTolerance(query: string, token: string): boolean {
  if (token.includes(query) || query.includes(token)) return true;
  if (query.length >= 4 && token.length >= 4) {
    if (Math.abs(query.length - token.length) <= 1 && levenshtein(query, token) <= 1) {
      return true;
    }
  }
  return false;
}

function useSearchIndex(): SearchItem[] {
  const t = useTranslations();
  return React.useMemo(
    () =>
      TOOLS.map((tool) => {
        const name = t(tool.nameKey as never);
        const description = t(tool.shortKey as never);
        const category = t(tool.category === 'pdf' ? 'categoryMeta.pdf.name' : `categoryMeta.${tool.category}.name` as never);
        const allKeywords = [...tool.keywords, name, description, tool.slug, category];
        const haystack = allKeywords.join(' ').toLowerCase();
        const tokens = allKeywords
          .flatMap((k) => k.toLowerCase().split(/[\s-_]+/))
          .filter((tok) => tok.length >= 2);

        return { slug: tool.slug, name, description, icon: tool.icon, category, haystack, tokens };
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
  const popular = React.useMemo(() => getPopularTools().slice(0, 4), []);
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    // Track search query
    trackSearch(q);

    // 1. Direct haystack & synonym matches
    const synonymSlugs = new Set<string>();
    for (const [key, slugs] of Object.entries(SYNONYMS)) {
      if (q.includes(key) || key.includes(q)) {
        slugs.forEach((s) => synonymSlugs.add(s));
      }
    }

    const matched = index.filter((item) => {
      if (synonymSlugs.has(item.slug)) return true;
      if (item.haystack.includes(q)) return true;
      // Check typo tolerance across item tokens
      return item.tokens.some((tok) => matchesWithTypoTolerance(q, tok));
    });

    return matched.slice(0, 8);
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
      setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
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
        <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && (results.length > 0 || Boolean(query.trim()))}
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
          className="h-11 w-full rounded-xl border border-input bg-background ps-10 pe-4 text-sm text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {open && query.trim() && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          {results.length === 0 ? (
            <div className="p-5 text-center space-y-4">
              <div>
                <p className="text-sm font-medium text-foreground">No tools found matching &quot;{query}&quot;</p>
                <p className="text-xs text-muted-foreground mt-0.5">Try a different search term or check popular tools below:</p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {popular.map((tool) => (
                  <button
                    key={tool.slug}
                    type="button"
                    onClick={() => go(tool.slug)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                  >
                    <ToolIcon name={tool.icon} className="h-3.5 w-3.5 text-primary" />
                    <span>{tool.slug.replace(/-/g, ' ')}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-border pt-3">
                <Link
                  href="/tools"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center text-xs font-medium text-primary hover:underline"
                >
                  Browse all tools <ArrowRight className="ms-1 h-3 w-3" />
                </Link>
              </div>
            </div>
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
