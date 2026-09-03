'use client';

/** Reusable page-thumbnail grid with selection, rotation and drag reordering. */

import * as React from 'react';
import { Check, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageTile {
  /** Original 0-based page index. */
  index: number;
  thumb?: string;
  rotation?: number;
  selected?: boolean;
  /** Display position (1-based) — differs from index after reordering. */
  position: number;
}

export function PageGrid({
  tiles,
  onToggle,
  onDrop,
  renderFooter,
  selectable = true,
  draggable = false,
  labelFor,
}: {
  tiles: PageTile[];
  onToggle?: (index: number) => void;
  onDrop?: (from: number, to: number) => void;
  renderFooter?: (tile: PageTile) => React.ReactNode;
  selectable?: boolean;
  draggable?: boolean;
  labelFor: (tile: PageTile) => string;
}) {
  const [dragFrom, setDragFrom] = React.useState<number | null>(null);

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {tiles.map((tile, position) => {
        const Wrapper = selectable ? 'button' : 'div';
        return (
          <li
            key={tile.index}
            draggable={draggable}
            onDragStart={() => setDragFrom(position)}
            onDragOver={(e) => draggable && e.preventDefault()}
            onDragEnd={() => setDragFrom(null)}
            onDrop={(e) => {
              if (!draggable) return;
              e.preventDefault();
              if (dragFrom !== null && dragFrom !== position) onDrop?.(dragFrom, position);
              setDragFrom(null);
            }}
            className={cn(
              'relative overflow-hidden rounded-lg border bg-card transition-all',
              tile.selected ? 'border-destructive ring-2 ring-destructive/40' : 'border-border',
              draggable && 'cursor-grab active:cursor-grabbing',
              dragFrom === position && 'opacity-50',
            )}
          >
            <Wrapper
              {...(selectable
                ? {
                    type: 'button' as const,
                    onClick: () => onToggle?.(tile.index),
                    'aria-pressed': Boolean(tile.selected),
                  }
                : {})}
              aria-label={labelFor(tile)}
              className="block w-full"
            >
              <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-secondary/50 p-2">
                {tile.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tile.thumb}
                    alt={labelFor(tile)}
                    loading="lazy"
                    className="max-h-full max-w-full object-contain shadow-sm transition-transform duration-200"
                    style={{ transform: `rotate(${tile.rotation ?? 0}deg)` }}
                  />
                ) : (
                  <div className="h-full w-full animate-pulse rounded bg-secondary" />
                )}
              </div>
            </Wrapper>

            <div className="flex items-center justify-between gap-1 border-t border-border px-2 py-1.5 text-xs">
              <span className="font-medium tabular-nums text-muted-foreground">{tile.position}</span>
              {draggable && <GripVertical className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
              {tile.rotation ? <span className="tabular-nums text-muted-foreground">{tile.rotation}°</span> : null}
            </div>

            {renderFooter && <div className="border-t border-border p-1.5">{renderFooter(tile)}</div>}

            {tile.selected && (
              <span className="pointer-events-none absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
