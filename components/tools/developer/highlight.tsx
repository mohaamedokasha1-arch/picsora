'use client';

/**
 * Lightweight syntax-highlighted output block.
 *
 * Prism.js core plus only the grammars the developer tools need, imported
 * dynamically so highlighting never lands in the main bundle. Highlighting is
 * purely presentational — the copyable value is always the raw string.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export type HighlightLanguage = 'json' | 'markup' | 'javascript' | 'css';

type Prism = typeof import('prismjs');

let prismPromise: Promise<Prism> | null = null;

async function loadPrism(): Promise<Prism> {
  if (!prismPromise) {
    prismPromise = (async () => {
      const prism = (await import('prismjs')).default ?? (await import('prismjs'));
      // Grammars: markup + css + clike + javascript ship in Prism core.
      // prismjs grammar side-effect modules ship without type declarations.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error - no bundled types for Prism grammar side-effect imports
      await import('prismjs/components/prism-json');
      return prism as Prism;
    })();
  }
  return prismPromise;
}

export function CodeBlock({
  code,
  language,
  showLineNumbers = true,
  maxHeight = 420,
  ariaLabel,
}: {
  code: string;
  language: HighlightLanguage;
  showLineNumbers?: boolean;
  maxHeight?: number;
  ariaLabel: string;
}) {
  const [html, setHtml] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    if (!code) {
      setHtml(null);
      return;
    }
    (async () => {
      try {
        const prism = await loadPrism();
        const grammar = prism.languages[language];
        if (!grammar) return;
        const result = prism.highlight(code, grammar, language);
        if (!cancelled) setHtml(result);
      } catch {
        if (!cancelled) setHtml(null); // fall back to plain text
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, language]);

  const lines = code ? code.split('\n').length : 0;

  return (
    <div
      className="flex overflow-auto rounded-lg border border-border bg-secondary/20"
      style={{ maxHeight }}
      role="region"
      aria-label={ariaLabel}
    >
      {showLineNumbers && lines > 0 && (
        <div
          aria-hidden="true"
          className="sticky start-0 select-none border-e border-border bg-secondary/50 px-2 py-3 text-end font-mono text-[13px] leading-relaxed text-muted-foreground"
          style={{ minWidth: 44 }}
        >
          {Array.from({ length: lines }, (_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
      )}
      <pre
        dir="ltr"
        className={cn('min-w-0 flex-1 overflow-x-auto p-3 font-mono text-[13px] leading-relaxed text-foreground')}
      >
        {html ? <code dangerouslySetInnerHTML={{ __html: html }} /> : <code>{code}</code>}
      </pre>
    </div>
  );
}
