'use client';

import * as React from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface ReorderListProps {
  items: { id: string; name: string; url: string }[];
  onReorder: (from: number, to: number) => void;
  onRemove?: (index: number) => void;
}

export function ReorderList({ items, onReorder, onRemove }: ReorderListProps) {
  const t = useTranslations('controls');
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((item, i) => (
        <li
          key={item.id}
          draggable
          onDragStart={() => setDragIndex(i)}
          onDragOver={(e) => {
            e.preventDefault();
            setOverIndex(i);
          }}
          onDragEnd={() => {
            if (dragIndex !== null && overIndex !== null && dragIndex !== overIndex) {
              onReorder(dragIndex, overIndex);
            }
            setDragIndex(null);
            setOverIndex(null);
          }}
          className={cn(
            'relative overflow-hidden rounded-lg border border-border bg-card transition-all',
            overIndex === i && dragIndex !== null && 'border-primary ring-2 ring-ring',
          )}
        >
          <div className="flex items-center justify-between bg-secondary/40 px-2 py-1">
            <span className="text-xs font-semibold text-muted-foreground">#{i + 1}</span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                aria-label={`${t('reorder')} — up`}
                disabled={i === 0}
                onClick={() => onReorder(i, i - 1)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`${t('reorder')} — down`}
                disabled={i === items.length - 1}
                onClick={() => onReorder(i, i + 1)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              {onRemove && (
                <button
                  type="button"
                  aria-label="remove"
                  onClick={() => onRemove(i)}
                  className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.url} alt={item.name} className="aspect-square w-full object-cover" />
          <div className="truncate px-2 py-1 text-[11px] text-muted-foreground" title={item.name}>
            {item.name}
          </div>
        </li>
      ))}
    </ul>
  );
}
