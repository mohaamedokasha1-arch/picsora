'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { ImageFormat, ProcessResult } from '@/lib/types';
import { formatLabel, isFormatEncodable } from '@/lib/image/format-support';
import { Notice } from '@/components/tools/kit';

/**
 * Browser output-format capability, exposed to the tool UIs.
 *
 * The probe touches a canvas, so it can only run in the browser. It is
 * therefore applied AFTER mount: the server-rendered markup and the first
 * client paint stay identical (no hydration mismatch), and a few milliseconds
 * later the UI can honestly tell the user "WebP is not available here, you
 * will get PNG" before they press the button — instead of failing afterwards.
 */
export interface FormatSupport {
  /** False until the probe has run (first paint). */
  checked: boolean;
  /** `encodable[format]` — true when this browser can write that format. */
  encodable: Partial<Record<ImageFormat, boolean>>;
}

export function useFormatSupport(formats: readonly ImageFormat[] = ['jpg', 'png', 'webp']): FormatSupport {
  const [state, setState] = React.useState<FormatSupport>({ checked: false, encodable: {} });

  React.useEffect(() => {
    const next: Partial<Record<ImageFormat, boolean>> = {};
    for (const format of formats) {
      try {
        next[format] = isFormatEncodable(format);
      } catch {
        // A probe that cannot run must never disable a working format.
        next[format] = true;
      }
    }
    setState({ checked: true, encodable: next });
    // `formats` is a literal array at every call site; join it so the effect
    // does not re-run on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formats.join(',')]);

  return state;
}

/**
 * Label for a format option, annotated when the browser cannot write it
 * ("WebP — PNG instead"). Kept selectable on purpose: the encoder handles the
 * substitution gracefully, so hiding the option would only confuse users whose
 * browser DOES support it after a hard refresh.
 */
export function formatOptionLabel(label: string, format: ImageFormat, support: FormatSupport): string {
  if (!support.checked || support.encodable[format] !== false) return label;
  // The encoder's substitution chain is PNG (then JPEG); PNG is what a browser
  // missing a WebP/AVIF encoder always ends up writing.
  return `${label} → ${formatLabel('png')}`;
}

/**
 * Pre-flight warning for a tool whose target format this browser cannot write.
 * Returns null when nothing needs to be said.
 */
export function FormatSupportNotice({ target }: { target: ImageFormat }) {
  const t = useTranslations();
  const support = useFormatSupport([target, 'png']);
  if (!support.checked || support.encodable[target] !== false) return null;
  return (
    <Notice variant="warning">
      {t('formats.unsupportedTarget', { from: formatLabel(target), to: 'PNG' })}
    </Notice>
  );
}

/**
 * Post-run explanation, shown by `ResultPanel` for ANY tool whose encoder had
 * to substitute a container: the file the user receives is valid, but they are
 * told what it actually is and why — an honest note instead of the old
 * "Something went wrong" crash panel.
 */
export function FormatFallbackNotice({ results }: { results: ProcessResult[] }) {
  const t = useTranslations();
  const pairs = React.useMemo(() => {
    const seen = new Map<string, { from: ImageFormat; to: ImageFormat; count: number }>();
    for (const result of results) {
      const from = result.fallbackFrom;
      if (!from) continue;
      const key = `${from}>${result.format}`;
      const existing = seen.get(key);
      if (existing) existing.count += 1;
      else seen.set(key, { from, to: result.format as ImageFormat, count: 1 });
    }
    return Array.from(seen.values());
  }, [results]);

  if (!pairs.length) return null;
  return (
    <Notice variant="warning">
      {pairs.map((pair) => (
        <p key={`${pair.from}-${pair.to}`}>
          {t('formats.fellBack', {
            n: pair.count,
            from: formatLabel(pair.from),
            to: formatLabel(pair.to),
          })}
        </p>
      ))}
    </Notice>
  );
}
