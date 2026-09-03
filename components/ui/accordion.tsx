'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccordionProps {
  items: { q: string; a: string }[];
  type?: 'single' | 'multiple';
  className?: string;
}

export function Accordion({ items, type = 'single', className }: AccordionProps) {
  const [open, setOpen] = React.useState<number[]>(type === 'multiple' ? [] : []);
  const toggle = (i: number) => {
    if (type === 'single') {
      setOpen(open.includes(i) ? [] : [i]);
    } else {
      setOpen(open.includes(i) ? open.filter((x) => x !== i) : [...open, i]);
    }
  };
  return (
    <div className={cn('divide-y divide-border rounded-xl border border-border bg-card', className)}>
      {items.map((item, i) => {
        const isOpen = open.includes(i);
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-start text-sm font-medium text-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5"
            >
              <span>{item.q}</span>
              <ChevronDown
                aria-hidden="true"
                className={cn(
                  'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180',
                )}
              />
            </button>
            <div
              className={cn(
                'grid transition-all duration-200 ease-out',
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
            >
              <div className="overflow-hidden">
                <p className="px-4 pb-4 text-sm leading-relaxed text-muted-foreground sm:px-5">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
